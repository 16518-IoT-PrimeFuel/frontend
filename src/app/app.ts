import { Component, inject, signal } from '@angular/core';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, TranslateModule],
  templateUrl: './app.html',
  styleUrls: ['./app.css'],
})
export class App {
  protected readonly title = signal('FrontedFulltank');
  private translate = inject(TranslateService);

  constructor() {
    this.translate.addLangs(['en', 'es']);
    let saved: string | null = null;
    try { saved = localStorage.getItem('fulltank.lang'); } catch { /* sin almacenamiento */ }
    this.translate.use(saved === 'en' || saved === 'es' ? saved : navigator.language.startsWith('es') ? 'es' : 'en');
  }
}
