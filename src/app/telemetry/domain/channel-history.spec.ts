import { describe, expect, it } from 'vitest';
import { appendReading, expectedSends, fieldStats, parseReading, readingKey, receivedSends, restoreEntries, toCsv } from './channel-history';
import { ChannelEntry } from './model/channel-entry.entity';

const payload = (seq: number, extra: Record<string, unknown> = {}) => JSON.stringify({ boot: 7, seq, uptime: 10, distancia: 42.5, nivel: 60, rssi: -61, alarma: 0, estado: 'Normal', ...extra });
const history = (rows: [boot: number, session: number, seq: number][]) => rows.reduce<ChannelEntry[]>((entries, [boot, session, seq]) =>
  appendReading(entries, parseReading(payload(seq, { boot }))!, session, '2026-01-01T00:00:00.000Z'), []);

describe('MQTT channel history', () => {
  it('parses a reading and rejects malformed payloads', () => {
    expect(parseReading(payload(3))).toEqual({ boot: 7, seq: 3, uptime: 10, distance: 42.5, level: 60, rssi: -61, alarm: 0, status: 'Normal' });
    expect(parseReading('not json')).toBeNull();
    expect(parseReading('[]')).toBeNull();
    expect(parseReading(JSON.stringify({ nivel: 50 }))).toBeNull();
    expect(parseReading(payload(1, { alarma: 2, estado: 5, seq: 1.5 }))).toMatchObject({ alarm: null, status: '', seq: null });
  });

  it('identifies duplicates by boot and sequence only when both are present', () => {
    expect(readingKey(parseReading(payload(3))!)).toBe('7:3');
    expect(readingKey(parseReading(payload(3, { boot: null }))!)).toBeNull();
  });

  it('numbers entries consecutively', () => {
    expect(history([[1, 1, 1], [1, 1, 2]]).map(entry => entry.entryId)).toEqual([1, 2]);
  });

  it('counts expected sends per device boot and monitor session', () => {
    const entries = history([[1, 1, 1], [1, 1, 2], [1, 1, 4], [2, 1, 1], [2, 2, 9], [2, 2, 8]]);
    expect(expectedSends(entries)).toBe(4 + 1 + 2);
    expect(receivedSends(entries)).toBe(6);
  });

  it('computes statistics ignoring missing values', () => {
    const entries = history([[1, 1, 1], [1, 1, 2]]);
    entries[1] = { ...entries[1], level: null, distance: 10 };
    expect(fieldStats(entries, 'distance')).toEqual({ min: 10, max: 42.5, avg: 26.25 });
    expect(fieldStats(entries, 'level')).toEqual({ min: 60, max: 60, avg: 60 });
    expect(fieldStats([], 'rssi')).toBeNull();
  });

  it('restores only well-formed stored entries', () => {
    const entries = history([[1, 1, 1]]);
    expect(restoreEntries(JSON.stringify([...entries, null, { entryId: 'x' }]))).toEqual(entries);
    expect(restoreEntries('{bad')).toEqual([]);
    expect(restoreEntries(null)).toEqual([]);
  });

  it('exports ThingSpeak-style CSV with quoted status', () => {
    const entries = appendReading([], parseReading(payload(1, { estado: 'Nivel "bajo", revisar' }))!, 1, '2026-01-01T00:00:00.000Z');
    expect(toCsv(entries)).toBe('created_at,entry_id,field1,field2,field3,field4,status,seq,boot\n2026-01-01T00:00:00.000Z,1,42.5,60,-61,0,"Nivel ""bajo"", revisar",1,7\n');
  });
});
