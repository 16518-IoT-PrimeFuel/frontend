import { Component, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { MatButtonToggle, MatButtonToggleGroup } from '@angular/material/button-toggle';

/**
 * @summary Selector de idioma global de FullTank.
 * @remarks Permite al usuario cambiar entre español e inglés. Utiliza
 * ngx-translate para aplicar el cambio de idioma de forma reactiva en
 * toda la aplicación. Se ubica en el toolbar del Layout principal.
 * @author FullTank Platform
 */
@Component({
  selector: 'app-language-switcher',
  imports: [MatButtonToggleGroup, MatButtonToggle],
  templateUrl: './language-switcher.html',
  styleUrl: './language-switcher.css',
})
export class LanguageSwitcher {
  protected currentLang = 'en';
  protected languages: string[] = ['en', 'es'];
  protected translate: TranslateService;

  constructor() {
    this.translate = inject(TranslateService);
    this.currentLang = this.translate.getCurrentLang();
  }

  useLanguage(language: string): void {
    this.translate.use(language);
    try { localStorage.setItem('fulltank.lang', language); } catch { /* sin almacenamiento */ }
    this.currentLang = language;
  }
}
