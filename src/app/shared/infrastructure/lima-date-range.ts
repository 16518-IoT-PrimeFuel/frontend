/** Lima usa UTC-5 sin horario de verano. Los filtros incluyen el día completo. */
export const limaToday = () => new Date(Date.now() - 5 * 60 * 60_000).toISOString().slice(0, 10);

export function limaDateBoundary(value: string, end = false): string | undefined {
  if (!value) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const midnight = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(midnight) || new Date(midnight).toISOString().slice(0, 10) !== value) return undefined;
  return new Date(midnight + 5 * 60 * 60_000 + (end ? 24 * 60 * 60_000 - 1 : 0)).toISOString();
}
