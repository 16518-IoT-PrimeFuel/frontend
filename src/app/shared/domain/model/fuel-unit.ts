export const unitKey = (unit: string | null | undefined) => unit?.startsWith('GALLON') ? 'unit.gallons' : 'unit.liters';

export function litresPerUnit(unit: string | null | undefined): number | null {
  return unit === 'GALLON' || unit === 'GALLONS' ? 3.785411784 : unit === 'LITRE' || unit === 'LITERS' ? 1 : null;
}
