import { expect, it } from 'vitest';
import { litresPerUnit, unitKey } from './fuel-unit';

it('keeps litre and gallon conversions consistent, supports legacy labels and rejects unknown units', () => {
  expect(litresPerUnit('GALLON')).toBe(3.785411784);
  expect(litresPerUnit('LITRE')).toBe(1);
  expect(litresPerUnit('GALLONS')).toBe(litresPerUnit('GALLON'));
  expect(litresPerUnit('LITERS')).toBe(litresPerUnit('LITRE'));
  expect(litresPerUnit('UNKNOWN')).toBeNull();
  expect(unitKey('LITRE')).toBe('unit.liters');
  expect(unitKey('GALLON')).toBe('unit.gallons');
});
