import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, NgZone, afterNextRender, computed, effect, inject, input, signal, viewChild } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { MatIconModule } from '@angular/material/icon';
import type { TankScene } from './tank-scene';

/**
 * Nivel del tanque como camión 3D que se puede girar, con el líquido simulado. La escena WebGL se
 * descarga aparte; sin WebGL (o si falla) queda la imagen con la barra de nivel.
 */
@Component({
  selector: 'app-tank-gauge-3d',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, MatIconModule],
  host: { '[class.low]': 'low()', '[class.live]': "state() === 'live'" },
  template: `
    @if (state() === 'flat') {
      <div class="tg-flat" role="img" [attr.aria-label]="label()">
        <img src="/tank-placeholder.webp" alt="" width="1400" height="574">
        <span class="tg-bar"><span [style.width.%]="percent()"></span>@if (lowPercent() !== null) { <i [style.left.%]="lowPercent()"></i> }</span>
      </div>
    } @else {
      <canvas #canvas tabindex="0" role="img" [attr.aria-label]="label() + '. ' + ('equipment.gauge-rotate-keys' | translate)"></canvas>
    }
    <p class="tg-pct" aria-hidden="true">{{ shown() }}%</p>
    <p class="tg-foot">
      @if (lowPercent() !== null) { <span class="tg-mark">{{ 'equipment.low-mark' | translate:{ n: lowPercent() } }}</span> }
      @if (state() === 'live') { <span class="tg-hint"><mat-icon aria-hidden="true">360</mat-icon>{{ 'equipment.gauge-rotate-hint' | translate }}</span> }
    </p>
  `,
  styles: [`
    :host{position:relative;display:block;overflow:hidden;border-radius:12px;background:#f4f6f9;color:#1f2d3d}
    canvas{display:block;width:100%;aspect-ratio:2/1;min-height:220px;opacity:0;cursor:grab;touch-action:pan-y;outline:none;transition:opacity .5s cubic-bezier(.16,1,.3,1)}
    :host(.live) canvas{opacity:1}
    canvas:active{cursor:grabbing}
    canvas:focus-visible{outline:2px solid #1e3a8a;outline-offset:-4px;border-radius:12px}
    .tg-pct{position:absolute;top:14px;left:18px;margin:0;font-size:clamp(1.5rem,4.4cqi,2.125rem);font-weight:600;line-height:1;font-variant-numeric:tabular-nums;color:#1e3a8a;pointer-events:none}
    :host(.low) .tg-pct{color:#8a3d05}
    .tg-foot{position:absolute;inset:auto 18px 12px;display:flex;flex-wrap:wrap;gap:4px 16px;justify-content:space-between;margin:0;color:#4b5563;font-size:.8125rem;pointer-events:none}
    .tg-mark,.tg-hint{display:inline-flex;align-items:center;gap:6px}
    .tg-mark::before{content:'';width:18px;height:3px;border-radius:2px;background:#b45309}
    .tg-hint{margin-left:auto}
    .tg-hint mat-icon{width:18px;height:18px;font-size:18px}
    .tg-flat{position:relative;max-width:620px;margin:0 auto;padding:44px 16px 40px}
    .tg-flat img{display:block;width:100%;height:auto;mix-blend-mode:multiply}
    .tg-bar{position:absolute;inset:auto 16px 30px;height:6px;border-radius:3px;background:#dbe2ee}
    .tg-bar span{position:absolute;inset:0 auto 0 0;border-radius:3px;background:#1e3a8a}
    :host(.low) .tg-bar span{background:#b45309}
    .tg-bar i{position:absolute;top:-4px;bottom:-4px;border-left:2px solid #7a4100}
    @media (prefers-reduced-motion:reduce){canvas{transition:none}}
  `],
})
export class TankGauge3d {
  /** Porcentaje de llenado, 0–100. */
  readonly percent = input.required<number>();
  /** Umbral de nivel bajo en porcentaje; `null` si el tanque no tiene política. */
  readonly lowPercent = input<number | null>(null);
  readonly low = input(false);
  /** Descripción accesible del medidor. */
  readonly label = input.required<string>();

  private readonly zone = inject(NgZone);
  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly scene = signal<TankScene | null>(null);
  private readonly pouring = signal<number | null>(null);
  protected readonly state = signal<'pending' | 'live' | 'flat'>('pending');
  /** Mientras el líquido entra o sale, el número acompaña al nivel que se ve. */
  protected readonly shown = computed(() => this.pouring() ?? this.percent());

  constructor() {
    const destroyRef = inject(DestroyRef);
    let destroyed = false;
    destroyRef.onDestroy(() => { destroyed = true; this.scene()?.dispose(); });

    // Fuera de la zona: el bucle de animación no debe disparar detección de cambios en cada cuadro.
    effect(() => { const scene = this.scene(), percent = this.percent(); this.zone.runOutsideAngular(() => scene?.setLevel(percent)); });
    effect(() => { const scene = this.scene(), low = this.low(); this.zone.runOutsideAngular(() => scene?.setLow(low)); });
    effect(() => { const scene = this.scene(), mark = this.lowPercent(); this.zone.runOutsideAngular(() => scene?.setLowMark(mark)); });

    afterNextRender(() => {
      const canvas = this.canvas()?.nativeElement;
      if (!canvas || typeof WebGL2RenderingContext === 'undefined') { this.state.set('flat'); return; }
      const flat = () => this.zone.run(() => { this.scene()?.dispose(); this.scene.set(null); this.pouring.set(null); this.state.set('flat'); });
      import('./tank-scene').then(({ TankScene }) => {
        if (destroyed) return;
        const scene = this.zone.runOutsideAngular(() => new TankScene({
          canvas,
          reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
          onLevel: (percent, settled) => this.zone.run(() => this.pouring.set(settled ? null : percent)),
          onLost: flat,
        }));
        const resize = new ResizeObserver(() => scene.resize(canvas.clientWidth, canvas.clientHeight));
        const sight = new IntersectionObserver(entries => scene.setVisible(entries[entries.length - 1].isIntersecting));
        this.zone.runOutsideAngular(() => { resize.observe(canvas); sight.observe(canvas); });
        destroyRef.onDestroy(() => { resize.disconnect(); sight.disconnect(); });
        scene.resize(canvas.clientWidth, canvas.clientHeight);
        this.scene.set(scene);
        this.state.set('live');
      }).catch(flat);
    });
  }
}
