import {
  BoxGeometry, BufferAttribute, BufferGeometry, CanvasTexture, Color, CylinderGeometry, DirectionalLight, DoubleSide, Group,
  Material, Mesh, MeshBasicMaterial, MeshPhysicalMaterial, MeshStandardMaterial, NeutralToneMapping, PerspectiveCamera,
  PlaneGeometry, PMREMGenerator, Points, PointsMaterial, Scene, SRGBColorSpace, Texture, WebGLRenderer,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { Slosh } from './slosh';

export interface TankSceneOptions {
  canvas: HTMLCanvasElement;
  reducedMotion: boolean;
  /** Porcentaje de llenado que se ve en este instante; `settled` cuando ya coincide con el objetivo. */
  onLevel: (percent: number, settled: boolean) => void;
  onLost: () => void;
}

// Medidas en metros. El tanque es la caja de carga; su interior va centrado en X/Z con el piso en y = 0.
const TANK = { length: 4.3, width: 1.9, height: 1.7 };
const GRID = { nx: 56, nz: 24 };
const INLET = { x: 0.62, z: 0.5 };
const TANK_X = 0.95;
const FLOOR_Y = 1.12;
const STEP = 1 / 240;
const REST_YAW = 0.5;
const REST_PITCH = 0.2;
const FALL_SPEED = 7;
const DROPS = 44;

const PALETTE = {
  ok: { surface: 0x2b4fb8, body: 0x1e3a8a, deep: 0x13275f },
  low: { surface: 0xd97a14, body: 0xb45309, deep: 0x7a3a06 },
};

export class TankScene {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(24, 2, 0.5, 60);
  private readonly truck = new Group();
  private readonly tank = new Group();
  private readonly sim = new Slosh(GRID.nx, GRID.nz, TANK.length, TANK.width, TANK.height, INLET);
  private readonly environment: Texture;
  private readonly water: Mesh<BufferGeometry, MeshPhysicalMaterial>;
  private readonly corners = new Float32Array((GRID.nx + 1) * (GRID.nz + 1));
  private readonly stream: Mesh;
  private readonly drops: Points<BufferGeometry, PointsMaterial>;
  private readonly dropVelocity = new Float32Array(DROPS * 3);
  private readonly dropLife = new Float32Array(DROPS);
  private readonly lowMark = new Group();
  private readonly abort = new AbortController();

  private yaw = REST_YAW;
  private pitch = REST_PITCH;
  private omega = 0;
  private alpha = 0;
  private dragging = false;
  private resetting = false;
  private pointer = { x: 0, y: 0 };
  private streamTop = 0;
  private streamBottom = TANK.height;
  private tint = 0;
  private tintTarget = 0;
  private shownPercent = -1;
  private shownSettled = false;
  private visible = true;
  private frame = 0;
  private last = 0;
  private carry = 0;
  private dropCursor = 0;

  constructor(private readonly options: TankSceneOptions) {
    const { canvas } = options;
    this.renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.toneMapping = NeutralToneMapping;
    this.renderer.outputColorSpace = SRGBColorSpace;

    const pmrem = new PMREMGenerator(this.renderer);
    this.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    this.scene.environment = this.environment;
    this.scene.environmentIntensity = 0.85;
    const key = new DirectionalLight(0xffffff, 1.5);
    key.position.set(-4, 9, 7);
    this.scene.add(key, this.truck);

    this.buildTruck();
    this.water = this.buildWater();
    this.stream = this.buildStream();
    this.drops = this.buildDrops();
    this.tank.add(this.water, this.stream, this.drops, this.lowMark);
    this.paintWater();

    const signal = this.abort.signal;
    canvas.addEventListener('pointerdown', this.onPointerDown, { signal });
    canvas.addEventListener('pointermove', this.onPointerMove, { signal });
    canvas.addEventListener('pointerup', this.onPointerUp, { signal });
    canvas.addEventListener('pointercancel', this.onPointerUp, { signal });
    canvas.addEventListener('dblclick', () => this.resetView(), { signal });
    canvas.addEventListener('keydown', this.onKey, { signal });
    canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); options.onLost(); }, { signal });
  }

  /** `percent` 0–100. La primera vez y en cada cambio el líquido entra o sale hasta ese nivel. */
  setLevel(percent: number): void {
    const depth = Math.min(100, Math.max(0, percent)) / 100 * TANK.height;
    if (this.options.reducedMotion) this.sim.settle(depth); else this.sim.target = depth;
    this.wake();
  }

  setLow(low: boolean): void {
    this.tintTarget = low ? 1 : 0;
    if (this.options.reducedMotion) this.tint = this.tintTarget;
    this.paintWater();
    this.wake();
  }

  /** Marca del umbral de nivel bajo, en porcentaje; `null` la oculta. */
  setLowMark(percent: number | null): void {
    this.lowMark.visible = percent !== null && percent > 0 && percent < 100;
    if (percent !== null) this.lowMark.position.y = percent / 100 * TANK.height;
    this.wake();
  }

  resize(width: number, height: number): void {
    if (width < 2 || height < 2) return;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.wake();
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    if (visible) this.wake();
  }

  resetView(): void {
    this.resetting = true;
    this.wake();
  }

  dispose(): void {
    cancelAnimationFrame(this.frame);
    this.abort.abort();
    this.scene.traverse(object => {
      const mesh = object as Partial<Mesh>;
      mesh.geometry?.dispose();
      for (const material of ([] as Material[]).concat(mesh.material ?? [])) {
        (material as MeshBasicMaterial).map?.dispose();
        material.dispose();
      }
    });
    this.environment.dispose();
    this.renderer.dispose();
  }

  private wake(): void {
    if (this.frame || !this.visible) return;
    this.last = 0;
    this.frame = requestAnimationFrame(this.tick);
  }

  private readonly tick = (now: number): void => {
    this.frame = 0;
    const dt = this.last ? Math.min(0.25, (now - this.last) / 1000) : 1 / 60;
    this.last = now;

    this.turn(dt);
    this.carry += dt;
    const forcing = { alpha: this.alpha, omega: this.omega, pivotX: TANK_X };
    for (let n = 0; n < 64 && this.carry >= STEP; n++, this.carry -= STEP) this.sim.step(STEP, forcing);
    if (this.carry > STEP) this.carry = 0;

    const pouring = this.pour(dt);
    const tinting = this.tint !== this.tintTarget;
    if (tinting) {
      this.tint += Math.sign(this.tintTarget - this.tint) * Math.min(Math.abs(this.tintTarget - this.tint), dt * 2.2);
      this.paintWater();
    }
    this.shapeWater();
    this.report();
    this.frameCamera();
    this.renderer.render(this.scene, this.camera);

    const busy = this.dragging || this.resetting || tinting || pouring || this.sim.mean !== this.sim.target
      || Math.abs(this.omega) > 0.004 || this.sim.activity > 0.006;
    if (busy && this.visible) this.frame = requestAnimationFrame(this.tick);
  };

  /** Giro del camión: arrastre directo, inercia al soltar y regreso amortiguado a la vista inicial. */
  private turn(dt: number): void {
    const before = this.omega;
    if (this.resetting) {
      const offset = Math.atan2(Math.sin(REST_YAW - this.yaw), Math.cos(REST_YAW - this.yaw));
      this.omega += (34 * offset - 11.5 * this.omega) * dt;
      this.pitch += (REST_PITCH - this.pitch) * Math.min(1, dt * 7);
      if (Math.abs(offset) < 0.002 && Math.abs(this.omega) < 0.02) { this.resetting = false; this.omega = 0; this.yaw = REST_YAW; this.pitch = REST_PITCH; }
    } else if (!this.dragging) {
      this.omega *= Math.exp(-2.6 * dt);
      if (Math.abs(this.omega) <= 0.004) this.omega = 0;
    }
    if (!this.dragging) this.yaw += this.omega * dt;
    const still = this.options.reducedMotion;
    this.alpha += ((still ? 0 : Math.max(-16, Math.min(16, (this.omega - before) / dt))) - this.alpha) * 0.5;
    this.truck.rotation.y = this.yaw;
    if (still) this.omega = this.resetting ? this.omega : 0;
  }

  /** Chorro y salpicaduras: la cabeza del chorro cae al abrir y la cola cae al cerrar. */
  private pour(dt: number): boolean {
    const surface = Math.min(TANK.height, Math.max(0, this.sim.inletDepth()));
    if (this.sim.pouring) {
      this.streamTop = TANK.height;
      this.streamBottom = Math.max(surface, this.streamBottom - FALL_SPEED * dt);
    } else {
      this.streamTop = Math.max(surface, this.streamTop - FALL_SPEED * dt);
      this.streamBottom = surface;
    }
    const length = this.streamTop - Math.min(this.streamBottom, this.streamTop);
    this.stream.visible = length > 0.01;
    this.stream.position.y = this.streamTop;
    this.stream.scale.set(1, Math.max(length, 0.001), 1);
    if (!this.sim.pouring && !this.stream.visible) this.streamBottom = TANK.height;

    const position = this.drops.geometry.getAttribute('position') as BufferAttribute;
    const p = position.array as Float32Array;
    const hitting = this.sim.pouring && this.streamBottom <= surface + 0.001;
    if (hitting) {
      for (let n = 0; n < 2; n++) {
        const k = this.dropCursor = (this.dropCursor + 1) % DROPS;
        const angle = Math.random() * Math.PI * 2, speed = 0.3 + Math.random() * 0.9;
        p[k * 3] = this.stream.position.x; p[k * 3 + 1] = surface + 0.02; p[k * 3 + 2] = this.stream.position.z;
        this.dropVelocity[k * 3] = Math.cos(angle) * speed;
        this.dropVelocity[k * 3 + 1] = 1.2 + Math.random() * 1.6;
        this.dropVelocity[k * 3 + 2] = Math.sin(angle) * speed;
        this.dropLife[k] = 1;
      }
    }
    let alive = false;
    const halfL = TANK.length / 2 - 0.05, halfW = TANK.width / 2 - 0.05;
    for (let k = 0; k < DROPS; k++) {
      if (this.dropLife[k] <= 0) continue;
      this.dropVelocity[k * 3 + 1] -= 9.81 * dt;
      p[k * 3] = Math.max(-halfL, Math.min(halfL, p[k * 3] + this.dropVelocity[k * 3] * dt));
      p[k * 3 + 1] += this.dropVelocity[k * 3 + 1] * dt;
      p[k * 3 + 2] = Math.max(-halfW, Math.min(halfW, p[k * 3 + 2] + this.dropVelocity[k * 3 + 2] * dt));
      if (p[k * 3 + 1] < this.sim.mean - 0.02 || p[k * 3 + 1] > TANK.height) { this.dropLife[k] = 0; p[k * 3 + 1] = -50; } else alive = true;
    }
    position.needsUpdate = true;
    return this.stream.visible || alive;
  }

  private report(): void {
    const settled = this.sim.mean === this.sim.target;
    const percent = Math.round(this.sim.mean / TANK.height * 100);
    if (percent === this.shownPercent && settled === this.shownSettled) return;
    this.shownPercent = percent;
    this.shownSettled = settled;
    this.options.onLevel(percent, settled);
  }

  private frameCamera(): void {
    const { camera } = this;
    const halfV = Math.tan(camera.fov * Math.PI / 360);
    const distance = Math.max(3.95 / (halfV * camera.aspect), 2.15 / halfV) + 1.2;
    camera.position.set(0, 1.55 + Math.sin(this.pitch) * distance, Math.cos(this.pitch) * distance);
    camera.lookAt(0, 1.55, 0);
    camera.updateProjectionMatrix();
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) return;
    this.options.canvas.setPointerCapture(event.pointerId);
    this.dragging = true;
    this.resetting = false;
    this.pointer = { x: event.clientX, y: event.clientY };
    this.wake();
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (!this.dragging) return;
    const dx = event.clientX - this.pointer.x, dy = event.clientY - this.pointer.y;
    this.pointer = { x: event.clientX, y: event.clientY };
    const turn = dx * 0.0085;
    this.yaw += turn;
    // La velocidad angular del arrastre es la que empuja el líquido y la que queda como inercia.
    const span = Math.max(1 / 240, (event.timeStamp - this.lastMove) / 1000);
    this.lastMove = event.timeStamp;
    this.omega = Math.max(-7, Math.min(7, this.omega * 0.6 + turn / span * 0.4));
    if (event.pointerType === 'mouse') this.pitch = Math.max(0.03, Math.min(0.8, this.pitch + dy * 0.005));
    this.wake();
  };
  private lastMove = 0;

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (!this.dragging) return;
    this.dragging = false;
    if (event.timeStamp - this.lastMove > 90) this.omega = 0;
    this.wake();
  };

  private readonly onKey = (event: KeyboardEvent): void => {
    const still = this.options.reducedMotion;
    switch (event.key) {
      case 'ArrowLeft': case 'ArrowRight': {
        const direction = event.key === 'ArrowLeft' ? -1 : 1;
        this.resetting = false;
        if (still) this.yaw += direction * 0.26; else this.omega = direction * 2.2;
        break;
      }
      case 'ArrowUp': this.pitch = Math.min(0.8, this.pitch + 0.08); break;
      case 'ArrowDown': this.pitch = Math.max(0.03, this.pitch - 0.08); break;
      case 'Home': if (still) { this.yaw = REST_YAW; this.pitch = REST_PITCH; } else this.resetView(); break;
      default: return;
    }
    event.preventDefault();
    this.wake();
  };

  // ───────────────────────────── líquido ─────────────────────────────

  private buildWater(): Mesh<BufferGeometry, MeshPhysicalMaterial> {
    const { nx, nz } = GRID;
    const top = (nx + 1) * (nz + 1), rim = 2 * (nx + 1) + 2 * (nz + 1);
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array((top + rim * 2) * 3), 3));
    geometry.setAttribute('normal', new BufferAttribute(new Float32Array((top + rim * 2) * 3), 3));
    geometry.setAttribute('color', new BufferAttribute(new Float32Array((top + rim * 2) * 3), 3));
    const index: number[] = [];
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const a = i + j * (nx + 1), b = a + 1, c = a + nx + 1, d = c + 1;
      index.push(a, c, b, b, c, d);
    }
    // Las paredes z− y x+ recorren el borde en sentido contrario: se invierte el triángulo para que miren hacia fuera.
    const strips: [number, number, boolean][] = [[top, nx + 1, true], [top + 2 * (nx + 1), nx + 1, false], [top + 4 * (nx + 1), nz + 1, false], [top + 4 * (nx + 1) + 2 * (nz + 1), nz + 1, true]];
    for (const [start, count, flip] of strips) {
      for (let n = 0; n < count - 1; n++) {
        const a = start + n * 2;
        if (flip) index.push(a, a + 2, a + 1, a + 2, a + 3, a + 1); else index.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
      }
    }
    geometry.setIndex(index);
    const normal = geometry.getAttribute('normal') as BufferAttribute;
    const wallNormals: [number, number][] = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    let v = top;
    for (const [side, count] of [[0, nx + 1], [1, nx + 1], [2, nz + 1], [3, nz + 1]]) {
      for (let n = 0; n < count * 2; n++, v++) normal.setXYZ(v, wallNormals[side][0], 0, wallNormals[side][1]);
    }
    const material = new MeshPhysicalMaterial({ vertexColors: true, roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.06 });
    const mesh = new Mesh(geometry, material);
    mesh.frustumCulled = false;
    return mesh;
  }

  /** Lleva el campo de alturas a la malla: superficie con normales propias y paredes hasta el piso. */
  private shapeWater(): void {
    const { nx, nz } = GRID, { h } = this.sim, { corners } = this;
    const lengthIn = TANK.length - 0.03, widthIn = TANK.width - 0.03;
    this.water.visible = this.sim.mean > 0.004;
    if (!this.water.visible) return;
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
      const i0 = Math.max(0, i - 1), i1 = Math.min(nx - 1, i), j0 = Math.max(0, j - 1), j1 = Math.min(nz - 1, j);
      const value = (h[i0 + j0 * nx] + h[i1 + j0 * nx] + h[i0 + j1 * nx] + h[i1 + j1 * nx]) / 4;
      corners[i + j * (nx + 1)] = value < 0.002 ? 0.002 : value > TANK.height - 0.012 ? TANK.height - 0.012 : value;
    }
    const position = this.water.geometry.getAttribute('position') as BufferAttribute;
    const normal = this.water.geometry.getAttribute('normal') as BufferAttribute;
    const cellX = lengthIn / nx, cellZ = widthIn / nz;
    const at = (i: number, j: number) => corners[Math.max(0, Math.min(nx, i)) + Math.max(0, Math.min(nz, j)) * (nx + 1)];
    let v = 0;
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++, v++) {
      position.setXYZ(v, i * cellX - lengthIn / 2, at(i, j), j * cellZ - widthIn / 2);
      const sx = (at(i + 1, j) - at(i - 1, j)) / (2 * cellX), sz = (at(i, j + 1) - at(i, j - 1)) / (2 * cellZ);
      const inv = 1 / Math.hypot(sx, 1, sz);
      normal.setXYZ(v, -sx * inv, inv, -sz * inv);
    }
    for (const j of [0, nz]) for (let i = 0; i <= nx; i++, v += 2) {
      const x = i * cellX - lengthIn / 2, z = j * cellZ - widthIn / 2;
      position.setXYZ(v, x, at(i, j), z); position.setXYZ(v + 1, x, 0, z);
    }
    for (const i of [0, nx]) for (let j = 0; j <= nz; j++, v += 2) {
      const x = i * cellX - lengthIn / 2, z = j * cellZ - widthIn / 2;
      position.setXYZ(v, x, at(i, j), z); position.setXYZ(v + 1, x, 0, z);
    }
    position.needsUpdate = true;
    normal.needsUpdate = true;
  }

  private paintWater(): void {
    const mix = (key: 'surface' | 'body' | 'deep') => new Color(PALETTE.ok[key]).lerp(new Color(PALETTE.low[key]), this.tint);
    const surface = mix('surface'), body = mix('body'), deep = mix('deep');
    const color = this.water.geometry.getAttribute('color') as BufferAttribute;
    const top = (GRID.nx + 1) * (GRID.nz + 1);
    for (let v = 0; v < top; v++) color.setXYZ(v, surface.r, surface.g, surface.b);
    for (let v = top; v < color.count; v += 2) { color.setXYZ(v, body.r, body.g, body.b); color.setXYZ(v + 1, deep.r, deep.g, deep.b); }
    color.needsUpdate = true;
    (this.stream.material as MeshPhysicalMaterial).color.copy(surface);
    this.drops.material.color.copy(surface);
  }

  private buildStream(): Mesh {
    const geometry = new CylinderGeometry(0.042, 0.058, 1, 14, 1, true).translate(0, -0.5, 0);
    const mesh = new Mesh(geometry, new MeshPhysicalMaterial({ roughness: 0.12, clearcoat: 1, side: DoubleSide }));
    mesh.position.set((INLET.x - 0.5) * TANK.length, TANK.height, (INLET.z - 0.5) * TANK.width);
    mesh.visible = false;
    return mesh;
  }

  private buildDrops(): Points<BufferGeometry, PointsMaterial> {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(DROPS * 3).fill(-50), 3));
    const dot = document.createElement('canvas');
    dot.width = dot.height = 32;
    const context = dot.getContext('2d')!;
    context.fillStyle = '#fff';
    context.beginPath(); context.arc(16, 16, 13, 0, Math.PI * 2); context.fill();
    const points = new Points(geometry, new PointsMaterial({ size: 0.075, map: new CanvasTexture(dot), alphaTest: 0.5, transparent: true }));
    points.frustumCulled = false;
    return points;
  }

  // ───────────────────────────── camión ─────────────────────────────

  private buildTruck(): void {
    const paint = new MeshStandardMaterial({ color: 0xf2f4f7, roughness: 0.42 });
    const frame = new MeshStandardMaterial({ color: 0x2c3442, roughness: 0.7 });
    const tire = new MeshStandardMaterial({ color: 0x171b21, roughness: 0.88 });
    const steel = new MeshStandardMaterial({ color: 0xc5ccd6, roughness: 0.28, metalness: 1 });
    const tinted = new MeshPhysicalMaterial({ color: 0x1a2330, roughness: 0.06, clearcoat: 1 });
    const lamp = new MeshStandardMaterial({ color: 0xfff3d6, emissive: 0xffe2a8, emissiveIntensity: 0.5, roughness: 0.3 });
    const tail = new MeshStandardMaterial({ color: 0xb3261e, roughness: 0.4 });
    const amber = new MeshStandardMaterial({ color: 0xb45309, roughness: 0.5 });
    const glass = new MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.14, roughness: 0.03, envMapIntensity: 1.6, depthWrite: false });

    const body = new Group();
    body.position.x = 0.05;
    this.truck.add(body);
    const add = (parent: Group, material: Material, size: [number, number, number], at: [number, number, number], radius = 0.03): Mesh => {
      const mesh = new Mesh(new RoundedBoxGeometry(...size, 3, Math.min(radius, Math.min(...size) / 2.01)), material);
      mesh.position.set(...at);
      parent.add(mesh);
      return mesh;
    };

    const shadow = document.createElement('canvas');
    shadow.width = 256; shadow.height = 128;
    const context = shadow.getContext('2d')!;
    context.scale(1, 0.5);
    const fade = context.createRadialGradient(128, 128, 20, 128, 128, 128);
    fade.addColorStop(0, 'rgba(22,32,52,.36)'); fade.addColorStop(0.55, 'rgba(22,32,52,.15)'); fade.addColorStop(1, 'rgba(22,32,52,0)');
    context.fillStyle = fade; context.fillRect(0, 0, 256, 256);
    const ground = new Mesh(new PlaneGeometry(9.2, 4.3), new MeshBasicMaterial({ map: new CanvasTexture(shadow), transparent: true, depthWrite: false, toneMapped: false }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0.005;
    body.add(ground);

    // Chasis, ejes y ruedas.
    add(body, frame, [6.3, 0.26, 0.96], [-0.05, 0.86, 0], 0.04);
    add(body, frame, [0.16, 0.3, 2.1], [3.12, 0.72, 0], 0.04);
    add(body, tail, [0.05, 0.12, 0.3], [3.21, 0.74, 0.78], 0.02);
    add(body, tail, [0.05, 0.12, 0.3], [3.21, 0.74, -0.78], 0.02);
    for (const z of [0.9, -0.9]) {
      const reserve = new Mesh(new CylinderGeometry(0.27, 0.27, 0.95, 28), steel);
      reserve.rotation.z = Math.PI / 2;
      reserve.position.set(-0.55, 0.66, z * 0.92);
      body.add(reserve);
    }
    const wheel = new CylinderGeometry(0.5, 0.5, 0.36, 40), hub = new CylinderGeometry(0.25, 0.25, 0.38, 28), cap = new CylinderGeometry(0.09, 0.09, 0.42, 16);
    for (const x of [-2.5, 1.45, 2.5]) for (const z of [0.86, -0.86]) {
      for (const [geometry, material] of [[wheel, tire], [hub, steel], [cap, frame]] as const) {
        const part = new Mesh(geometry, material);
        part.rotation.x = Math.PI / 2;
        part.position.set(x, 0.5, z);
        body.add(part);
      }
    }

    // Cabina sobre el eje delantero.
    add(body, paint, [1.8, 1.56, 2.08], [-2.35, 1.84, 0], 0.16);
    add(body, frame, [1.5, 0.5, 1.3], [-2.35, 0.84, 0], 0.05);
    add(body, frame, [0.3, 0.42, 2.14], [-3.16, 0.64, 0], 0.08);
    add(body, tinted, [0.06, 0.7, 1.78], [-3.235, 2.12, 0], 0.03);
    add(body, frame, [0.06, 0.3, 1.5], [-3.235, 1.42, 0], 0.03);
    for (const z of [1, -1]) {
      add(body, tinted, [0.92, 0.6, 0.05], [-2.62, 2.14, z * 1.025], 0.02);
      add(body, lamp, [0.06, 0.13, 0.3], [-3.3, 0.68, z * 0.78], 0.02);
      add(body, frame, [0.08, 0.34, 0.14], [-3.1, 2.08, z * 1.16], 0.03);
      add(body, frame, [0.86, 0.05, 0.04], [-2.62, 1.5, z * 1.045], 0.02);
    }
    add(body, paint, [1.2, 0.34, 1.9], [-2.1, 2.72, 0], 0.14);

    // Tanque: piso, bastidor y paredes de vidrio.
    this.tank.position.set(TANK_X, FLOOR_Y, 0);
    body.add(this.tank);
    const { length, width, height } = TANK, post = 0.07;
    add(this.tank, paint, [length + 0.2, 0.14, width + 0.2], [0, -0.07, 0], 0.03);
    for (const x of [1, -1]) for (const z of [1, -1]) add(this.tank, paint, [post, height + 0.06, post], [x * (length / 2 + 0.04), height / 2, z * (width / 2 + 0.04)], 0.015);
    for (const z of [1, -1]) add(this.tank, paint, [length + 0.14, post, post], [0, height + 0.04, z * (width / 2 + 0.04)], 0.015);
    for (const x of [1, -1]) add(this.tank, paint, [post, post, width + 0.14], [x * (length / 2 + 0.04), height + 0.04, 0], 0.015);
    const inletX = (INLET.x - 0.5) * length;
    add(this.tank, paint, [0.3, post, width + 0.1], [inletX, height + 0.04, 0], 0.015);
    const collar = new Mesh(new CylinderGeometry(0.15, 0.17, 0.16, 28), steel);
    collar.position.set(inletX, height + 0.13, 0);
    const lid = new Mesh(new CylinderGeometry(0.19, 0.19, 0.04, 28), frame);
    lid.position.set(inletX, height + 0.22, 0);
    this.tank.add(collar, lid);
    for (const fraction of [0.25, 0.5, 0.75]) for (const z of [1, -1]) {
      add(this.tank, frame, [fraction === 0.5 ? 0.2 : 0.12, 0.018, 0.012], [-length / 2 + (fraction === 0.5 ? 0.13 : 0.09), fraction * height, z * (width / 2 + 0.03)], 0.004);
    }
    const walls = new Mesh(new BoxGeometry(length + 0.02, height, width + 0.02), glass);
    walls.position.y = height / 2;
    walls.renderOrder = 2;
    this.tank.add(walls);

    for (const z of [1, -1]) add(this.lowMark, amber, [length + 0.1, 0.026, 0.014], [0, 0, z * (width / 2 + 0.03)], 0.005);
    for (const x of [1, -1]) add(this.lowMark, amber, [0.014, 0.026, width + 0.1], [x * (length / 2 + 0.03), 0, 0], 0.005);
    this.lowMark.visible = false;
  }
}
