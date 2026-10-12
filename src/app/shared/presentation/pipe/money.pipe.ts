import { inject, Pipe, PipeTransform } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

@Pipe({ name: 'money', standalone: true, pure: false })
export class MoneyPipe implements PipeTransform {
  private readonly translate = inject(TranslateService);

  transform(amount: number | null | undefined, currency: string | null = 'PEN'): string {
    if (amount == null || !Number.isFinite(amount)) return '—';
    const locale = this.translate.getCurrentLang() === 'en' ? 'en-US' : 'es-PE';
    if (!currency) return new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
    try { return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount); }
    catch { return '—'; }
  }
}
