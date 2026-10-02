import { SalesTrendPoint } from './model/analytics.entity';

export type TrendGranularity = 'day' | 'week' | 'month';

const DAY_MS = 86_400_000;
const toMs = (d: string) => Date.parse(`${d}T00:00:00Z`);
const toIso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Rellena los días vacíos con 0 entre from y to y agrupa por día, semana (lunes ISO) o mes (yyyy-MM). */
export function groupSalesTrend(points: SalesTrendPoint[], by: TrendGranularity, from: string, to: string): SalesTrendPoint[] {
  const byDay = new Map(points.map((p) => [p.date, p.litres]));
  const out = new Map<string, number>();
  for (let t = toMs(from); t <= toMs(to); t += DAY_MS) {
    const day = toIso(t);
    const key = by === 'day' ? day : by === 'month' ? day.slice(0, 7) : toIso(t - ((new Date(t).getUTCDay() + 6) % 7) * DAY_MS);
    out.set(key, (out.get(key) ?? 0) + (byDay.get(day) ?? 0));
  }
  return [...out].map(([date, litres]) => ({ date, litres }));
}
