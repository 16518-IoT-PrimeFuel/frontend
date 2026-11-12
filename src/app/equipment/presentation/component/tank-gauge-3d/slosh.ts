/** Aceleraciones que siente el líquido en el marco del tanque (m/s², rad/s, rad/s²). */
export interface SloshForcing {
  /** Aceleración angular del giro sobre el eje vertical. */
  alpha: number;
  /** Velocidad angular del giro. */
  omega: number;
  /** Distancia en X del centro del tanque al eje de giro. */
  pivotX: number;
}

const GRAVITY = 9.81;
const DAMPING = 1.5;
/** Viscosidad numérica (m²/s): apaga el rizado de alta frecuencia sin frenar el oleaje largo. */
const VISCOSITY = 0.035;
const MAX_ACCEL = 4.5;
const MIN_WAVE_DEPTH = 0.05;

/**
 * Líquido en un tanque rectangular como campo de alturas (aguas someras) sobre malla
 * escalonada: `h` en el centro de cada celda y velocidades en las caras, con paredes impermeables.
 * El volumen solo cambia por `pour`/`drain`, así que el llenado es masa real entrando por la boca.
 */
export class Slosh {
  readonly h: Float32Array;
  private readonly u: Float32Array;
  private readonly w: Float32Array;
  private readonly scratch: Float32Array;
  readonly dx: number;
  readonly dz: number;
  /** Profundidad media actual (volumen / área). */
  mean = 0;
  /** Profundidad media objetivo. */
  target = 0;
  /** Mayor velocidad y mayor desnivel del último paso: indican si el líquido ya reposa. */
  activity = 0;
  pouring = false;

  constructor(
    readonly nx: number, readonly nz: number,
    readonly length: number, readonly width: number, readonly height: number,
    /** Posición de la boca de llenado, en fracción [0,1] del largo y del ancho. */
    private readonly inlet: { x: number; z: number } = { x: 0.5, z: 0.5 },
  ) {
    this.h = new Float32Array(nx * nz);
    this.u = new Float32Array((nx + 1) * nz);
    this.w = new Float32Array(nx * (nz + 1));
    this.scratch = new Float32Array(nx * nz);
    this.dx = length / nx;
    this.dz = width / nz;
  }

  /** Fija el nivel sin animación: superficie plana y en reposo. */
  settle(depth: number): void {
    this.mean = this.target = Math.min(this.height, Math.max(0, depth));
    this.h.fill(this.mean);
    this.u.fill(0);
    this.w.fill(0);
    this.activity = 0;
    this.pouring = false;
  }

  step(dt: number, forcing: SloshForcing): void {
    const { nx, nz, dx, dz, h, u, w, length, width, height } = this;
    // Cerca del fondo o del techo no hay espacio para olas: se atenúa el empuje.
    const room = Math.min(1, Math.max(0, Math.min(this.mean, height - this.mean) / (0.15 * height)));
    const damp = Math.exp(-DAMPING * dt);
    const w2 = forcing.omega * forcing.omega;
    let maxSpeed = 0;

    for (let j = 0; j < nz; j++) {
      const z = (j + 0.5) * dz - width / 2;
      for (let i = 1; i < nx; i++) {
        const x = i * dx - length / 2 + forcing.pivotX;
        const push = clamp(-forcing.alpha * z + w2 * x, MAX_ACCEL) * room;
        const k = i + j * (nx + 1);
        const v = (u[k] + dt * (-GRAVITY * (h[i + j * nx] - h[i - 1 + j * nx]) / dx + push)) * damp;
        u[k] = v;
        if (v > maxSpeed) maxSpeed = v; else if (-v > maxSpeed) maxSpeed = -v;
      }
    }
    for (let j = 1; j < nz; j++) {
      const z = j * dz - width / 2;
      for (let i = 0; i < nx; i++) {
        const x = (i + 0.5) * dx - length / 2 + forcing.pivotX;
        const push = clamp(forcing.alpha * x + w2 * z, MAX_ACCEL) * room;
        const k = i + j * nx;
        const v = (w[k] + dt * (-GRAVITY * (h[k] - h[k - nx]) / dz + push)) * damp;
        w[k] = v;
        if (v > maxSpeed) maxSpeed = v; else if (-v > maxSpeed) maxSpeed = -v;
      }
    }
    // Forma de flujo con la profundidad de cada cara: un montículo se desparrama tan rápido como es alto.
    const { scratch } = this;
    scratch.set(h);
    const face = (a: number, b: number) => Math.max(MIN_WAVE_DEPTH, (scratch[a] + scratch[b]) / 2);
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const k = i + j * nx, f = i + j * (nx + 1);
        const west = i > 0 ? face(k - 1, k) * u[f] : 0, east = i < nx - 1 ? face(k, k + 1) * u[f + 1] : 0;
        const south = j > 0 ? face(k - nx, k) * w[k] : 0, north = j < nz - 1 ? face(k, k + nx) * w[k + nx] : 0;
        h[k] -= dt * ((east - west) / dx + (north - south) / dz);
      }
    }

    this.smooth(dt);
    this.exchange(dt);
    this.contain();

    let maxSwell = 0;
    for (let k = 0; k < h.length; k++) { const d = Math.abs(h[k] - this.mean); if (d > maxSwell) maxSwell = d; }
    this.activity = Math.max(maxSpeed, maxSwell * 4);
  }

  /** Altura de la superficie bajo la boca de llenado. */
  inletDepth(): number {
    const i = Math.min(this.nx - 1, Math.floor(this.inlet.x * this.nx));
    const j = Math.min(this.nz - 1, Math.floor(this.inlet.z * this.nz));
    return this.h[i + j * this.nx];
  }

  /** Difusión entre celdas vecinas; cada intercambio es simétrico, así que conserva el volumen. */
  private smooth(dt: number): void {
    const { nx, nz, h, scratch } = this;
    const kx = VISCOSITY * dt / (this.dx * this.dx), kz = VISCOSITY * dt / (this.dz * this.dz);
    scratch.set(h);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const k = i + j * nx, v = scratch[k];
      let d = 0;
      if (i > 0) d += kx * (scratch[k - 1] - v);
      if (i < nx - 1) d += kx * (scratch[k + 1] - v);
      if (j > 0) d += kz * (scratch[k - nx] - v);
      if (j < nz - 1) d += kz * (scratch[k + nx] - v);
      h[k] = v + d;
    }
  }

  /** Acerca el volumen al objetivo: entra por la boca (chorro) o sale parejo por el fondo. */
  private exchange(dt: number): void {
    const { nx, nz, h, height } = this;
    const gap = this.target - this.mean;
    this.pouring = gap > 1e-4;
    if (Math.abs(gap) <= 1e-4) { this.mean = this.target; return; }
    const rate = Math.min(Math.abs(gap) / dt, Math.max(0.04 * height, Math.min(Math.abs(gap) * 2.4, height / 4)));
    const delta = Math.sign(gap) * rate * dt;
    if (delta < 0) {
      for (let k = 0; k < h.length; k++) h[k] += delta;
    } else {
      const ci = this.inlet.x * nx - 0.5, cj = this.inlet.z * nz - 0.5;
      const sigma = 9;
      let total = 0;
      for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) total += Math.exp(-((i - ci) ** 2 + (j - cj) ** 2) / (2 * sigma * sigma));
      const scale = delta * nx * nz / total;
      for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) h[i + j * nx] += scale * Math.exp(-((i - ci) ** 2 + (j - cj) ** 2) / (2 * sigma * sigma));
    }
    this.mean += delta;
  }

  /** El líquido no atraviesa el fondo ni el techo; lo recortado se reparte para conservar el volumen. */
  private contain(): void {
    const { h, height } = this;
    for (let pass = 0; pass < 2; pass++) {
      let sum = 0;
      for (let k = 0; k < h.length; k++) { const v = h[k] < 0 ? 0 : h[k] > height ? height : h[k]; h[k] = v; sum += v; }
      const fix = this.mean - sum / h.length;
      if (Math.abs(fix) < 1e-7) return;
      for (let k = 0; k < h.length; k++) h[k] += fix;
    }
  }
}

function clamp(value: number, limit: number): number {
  return value > limit ? limit : value < -limit ? -limit : value;
}
