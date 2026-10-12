import { expect, it, vi } from 'vitest';
import { limaDateBoundary, limaToday } from './lima-date-range';

it('uses inclusive Lima days, handles leap years and rejects impossible calendar dates', () => {
  expect(limaDateBoundary('2026-10-01')).toBe('2026-10-01T05:00:00.000Z');
  expect(limaDateBoundary('2026-10-02', true)).toBe('2026-10-03T04:59:59.999Z');
  expect(limaDateBoundary('2024-02-29')).toBe('2024-02-29T05:00:00.000Z');
  for (const value of ['', '0', '2026-02-29', '2026-13-01']) expect(limaDateBoundary(value)).toBeUndefined();
  const now = vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-12T03:00:00Z'));
  expect(limaToday()).toBe('2026-10-11');
  now.mockRestore();
});
