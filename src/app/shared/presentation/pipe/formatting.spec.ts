import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { expect, it } from 'vitest';
import { LimaDatePipe } from './lima-date.pipe';
import { MoneyPipe } from './money.pipe';

it('renders UTC timestamps in Lima and preserves legacy local timestamps', () => {
  const pipe = new LimaDatePipe();
  expect(pipe.transform('2026-10-02T03:00:00Z')).toBe('01/10/2026 22:00');
  expect(pipe.transform('2026-10-02T07:00:00')).toBe('02/10/2026 07:00');
  expect(pipe.transform('2026-10-02T12:00:00Z')).toBe('02/10/2026 07:00');
  expect(pipe.transform('invalid')).toBe('—');
});

it('uses the returned currency and reacts to language changes without inventing a missing currency', () => {
  let language = 'es';
  TestBed.configureTestingModule({ providers: [{ provide: TranslateService, useValue: { getCurrentLang: () => language } }] });
  const pipe = TestBed.runInInjectionContext(() => new MoneyPipe());
  expect(pipe.transform(200, 'PEN')).toBe(new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(200));
  language = 'en';
  expect(pipe.transform(200, 'USD')).toBe('$200.00');
  expect(pipe.transform(200, null)).toBe('200.00');
  expect(pipe.transform(NaN)).toBe('—');
  TestBed.resetTestingModule();
});
