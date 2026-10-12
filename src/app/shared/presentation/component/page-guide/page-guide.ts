import { Component, input, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';

let nextId = 0;

/**
 * Botón de información (modo guía): despliega qué verá el usuario en la vista, cómo leerla y qué puede hacer.
 * Los textos viven en i18n bajo `<key>.what`, `<key>.read` y `<key>.next`.
 */
@Component({
  selector: 'app-page-guide',
  standalone: true,
  imports: [MatIconModule, TranslatePipe],
  template: `
    <button type="button" class="guide-toggle" [attr.aria-expanded]="open()" [attr.aria-controls]="panelId" (click)="open.set(!open())">
      <mat-icon aria-hidden="true">{{ open() ? 'expand_less' : 'info_outline' }}</mat-icon>{{ 'guide.toggle' | translate }}
    </button>
    @if (open()) {
      <section class="guide-panel" [id]="panelId" [attr.aria-label]="'guide.toggle' | translate">
        @for (part of parts; track part) {
          <div><h2>{{ 'guide.' + part | translate }}</h2><p>{{ key() + '.' + part | translate }}</p></div>
        }
      </section>
    }
  `,
  styles: [`
    :host{display:block;margin-bottom:16px}
    .guide-toggle{display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:0 10px;border:0;border-radius:8px;background:transparent;color:#1e3a8a;font:inherit;font-size:14px;font-weight:500;cursor:pointer}
    .guide-toggle:hover{background:#eef2f7}
    .guide-toggle:focus-visible{outline:2px solid #1e3a8a;outline-offset:2px}
    .guide-toggle mat-icon{width:20px;height:20px;font-size:20px}
    .guide-panel{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px 24px;margin-top:4px;padding:16px 20px;border-radius:12px;background:#eff6ff;color:#243447;font-size:14px;line-height:1.6}
    .guide-panel h2{margin:0 0 4px;color:#1e3a8a;font-size:13px;font-weight:600}
    .guide-panel p{margin:0;max-width:60ch}
  `],
})
export class PageGuide {
  /** Prefijo i18n del contenido, p. ej. `guide.requests.buyer`. */
  readonly key = input.required<string>();
  protected readonly open = signal(false);
  protected readonly parts = ['what', 'read', 'next'] as const;
  protected readonly panelId = `page-guide-${nextId++}`;
}
