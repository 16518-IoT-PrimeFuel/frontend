import { DatePipe } from '@angular/common';
import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'limaDate', standalone: true })
export class LimaDatePipe implements PipeTransform {
  private readonly date = new DatePipe('en-US');

  transform(value: string | null | undefined, format = 'dd/MM/yyyy HH:mm'): string {
    if (!value) return '—';
    // Las respuestas antiguas sin zona representan hora local de Lima según el ledger.
    const instant = /^\d{4}-\d{2}-\d{2}T/.test(value) && !/(Z|[+-]\d{2}:?\d{2})$/.test(value) ? `${value}-05:00` : value;
    try { return this.date.transform(instant, format, '-0500') ?? '—'; }
    catch { return '—'; }
  }
}
