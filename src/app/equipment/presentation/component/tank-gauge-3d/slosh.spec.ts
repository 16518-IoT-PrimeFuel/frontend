import { describe, expect, it } from 'vitest';
import { Slosh, SloshForcing } from './slosh';

const still: SloshForcing = { alpha: 0, omega: 0, pivotX: 0 };
const volume = (s: Slosh) => s.h.reduce((sum, v) => sum + v, 0) / s.h.length;
const spread = (s: Slosh) => Math.max(...s.h) - Math.min(...s.h);
const run = (s: Slosh, seconds: number, forcing = still) => { for (let t = 0; t < seconds; t += 1 / 240) s.step(1 / 240, forcing); };

describe('Slosh', () => {
  const make = () => new Slosh(40, 16, 4, 1.6, 1.6, { x: 0.6, z: 0.5 });

  it('fills to the target level through the inlet and comes to rest flat', () => {
    const s = make();
    s.target = 1.2;
    run(s, 0.3);
    expect(s.pouring).toBe(true);
    expect(s.inletDepth()).toBeGreaterThan(s.h[0]);
    run(s, 14);
    expect(s.pouring).toBe(false);
    expect(volume(s)).toBeCloseTo(1.2, 3);
    expect(spread(s)).toBeLessThan(0.01);
  });

  it('drains down to a lower target', () => {
    const s = make();
    s.settle(1.2);
    s.target = 0.4;
    run(s, 8);
    expect(volume(s)).toBeCloseTo(0.4, 3);
  });

  it('sloshes when the tank spins without gaining or losing liquid', () => {
    const s = make();
    s.settle(0.8);
    run(s, 0.4, { alpha: 6, omega: 2, pivotX: 1 });
    expect(spread(s)).toBeGreaterThan(0.05);
    expect(volume(s)).toBeCloseTo(0.8, 4);
    expect(Math.min(...s.h)).toBeGreaterThanOrEqual(-1e-4);
    expect(Math.max(...s.h)).toBeLessThanOrEqual(1.6 + 1e-4);
  });

  it('keeps a full tank inside its walls', () => {
    const s = make();
    s.settle(1.6);
    run(s, 1, { alpha: 7, omega: 4, pivotX: 1 });
    expect(Math.max(...s.h)).toBeLessThanOrEqual(1.6 + 1e-4);
    expect(volume(s)).toBeCloseTo(1.6, 3);
  });
});
