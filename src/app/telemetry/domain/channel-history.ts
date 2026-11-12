import { ChannelEntry, ChannelField, TankReading } from './model/channel-entry.entity';

export const MAX_ENTRIES = 5000;

const finite = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;
const integer = (value: unknown): number | null => Number.isInteger(value) ? value as number : null;

/** `null` si el mensaje no es JSON o no trae una distancia numérica. */
export function parseReading(text: string): TankReading | null {
  let data: unknown;
  try { data = JSON.parse(text); } catch { return null; }
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>, distance = finite(d['distancia']);
  if (distance === null) return null;
  return {
    boot: integer(d['boot']), seq: integer(d['seq']), uptime: finite(d['uptime']), distance,
    level: finite(d['nivel']), rssi: finite(d['rssi']),
    alarm: d['alarma'] === 1 || d['alarma'] === 0 ? d['alarma'] : null,
    status: typeof d['estado'] === 'string' ? d['estado'].slice(0, 80) : '',
  };
}

/** Identifica una lectura por encendido del ESP32 y número de secuencia; `null` si no se puede deduplicar. */
export function readingKey(reading: Pick<TankReading, 'boot' | 'seq'>): string | null {
  return reading.boot !== null && reading.seq !== null ? `${reading.boot}:${reading.seq}` : null;
}

export function appendReading(entries: ChannelEntry[], reading: TankReading, session: number, createdAt: string): ChannelEntry[] {
  const entryId = (entries.at(-1)?.entryId ?? 0) + 1;
  return [...entries, { ...reading, entryId, createdAt, session }].slice(-MAX_ENTRIES);
}

/** Descarta lo que no tenga la forma de una entrada guardada por este monitor. */
export function restoreEntries(raw: string | null): ChannelEntry[] {
  try {
    const rows: unknown = JSON.parse(raw ?? '[]');
    if (!Array.isArray(rows)) return [];
    return rows.filter((row): row is ChannelEntry => !!row && typeof row === 'object'
      && Number.isInteger(row.entryId) && typeof row.createdAt === 'string' && Number.isFinite(Date.parse(row.createdAt))).slice(-MAX_ENTRIES);
  } catch { return []; }
}

/**
 * Envíos esperados: por cada tramo (mismo encendido del ESP32 y misma conexión del monitor) se esperan
 * `último seq − primer seq + 1`. Así no cuentan como perdidas las lecturas enviadas con el monitor cerrado.
 */
export function expectedSends(entries: ChannelEntry[]): number {
  const spans = new Map<string, { lo: number; hi: number }>();
  for (const entry of entries) {
    if (entry.seq === null || !Number.isInteger(entry.seq)) continue;
    const key = `${entry.boot}|${entry.session}`, span = spans.get(key);
    if (!span) spans.set(key, { lo: entry.seq, hi: entry.seq });
    else { span.lo = Math.min(span.lo, entry.seq); span.hi = Math.max(span.hi, entry.seq); }
  }
  let total = 0;
  for (const span of spans.values()) total += span.hi - span.lo + 1;
  return total;
}

export function receivedSends(entries: ChannelEntry[]): number {
  return entries.filter(entry => entry.seq !== null && Number.isInteger(entry.seq)).length;
}

export function fieldStats(entries: ChannelEntry[], field: ChannelField): { min: number; max: number; avg: number } | null {
  const values = entries.map(entry => entry[field]).filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (!values.length) return null;
  let min = values[0], max = values[0], sum = 0;
  for (const value of values) { min = Math.min(min, value); max = Math.max(max, value); sum += value; }
  return { min, max, avg: sum / values.length };
}

/** CSV con las columnas de ThingSpeak más `seq` y `boot`. */
export function toCsv(entries: ChannelEntry[]): string {
  const quote = (text: string) => `"${text.replace(/"/g, '""')}"`;
  const lines = entries.map(e => [e.createdAt, e.entryId, e.distance ?? '', e.level ?? '', e.rssi ?? '', e.alarm ?? '', quote(e.status || ''), e.seq ?? '', e.boot ?? ''].join(','));
  return ['created_at,entry_id,field1,field2,field3,field4,status,seq,boot', ...lines].join('\n') + '\n';
}
