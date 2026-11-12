import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { BaseChartDirective } from 'ng2-charts';
import type { ChartData, ChartOptions } from 'chart.js';
import type { MqttClient } from 'mqtt';
import { CONFIRM_DIALOG_CONFIG, ConfirmDialog } from '../../../../shared/presentation/component/confirm-dialog/confirm-dialog';
import { BrokerState, ChannelEntry, ChannelField, DeviceState } from '../../../domain/model/channel-entry.entity';
import { appendReading, expectedSends, fieldStats, parseReading, readingKey, receivedSends, restoreEntries, toCsv } from '../../../domain/channel-history';

const STORAGE_PREFIX = 'fulltank-mqtt:history:';
const CONFIG_KEY = 'fulltank-mqtt:cfg';
const DEFAULT_BROKER = 'wss://broker.hivemq.com:8884/mqtt';
const LINE = '#1e3a8a';

interface FieldChart { field: ChannelField; label: string; data: ChartData<'line', (number | null)[], string>; options: ChartOptions<'line'> }

function lineOptions(scale: { min?: number; max?: number; step?: number } = {}): ChartOptions<'line'> {
  return {
    responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { maxTicksLimit: 6, color: '#4b5563' }, grid: { color: '#eef0f4' } },
      y: { min: scale.min, max: scale.max, ticks: { color: '#4b5563', stepSize: scale.step }, grid: { color: '#eef0f4' } },
    },
  };
}

/** Monitor en tiempo real del canal MQTT de un tanque: se conecta al broker desde el navegador, sin pasar por el backend. */
@Component({
  selector: 'app-mqtt-monitor',
  standalone: true,
  imports: [DatePipe, DecimalPipe, FormsModule, TranslatePipe, BaseChartDirective, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatProgressBarModule, MatSelectModule],
  templateUrl: './mqtt-monitor.html',
  styleUrl: './mqtt-monitor.css',
})
export class MqttMonitor {
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  private dialogRef?: MatDialogRef<unknown>;
  private client?: MqttClient;
  private generation = 0;
  /** Cambia en cada conexión al broker; separa los tramos de secuencia. */
  private session = 0;
  private readonly seen = new Set<string>();
  private readonly now = signal(Date.now());

  protected brokerUrl = DEFAULT_BROKER;
  protected topicBase = '';
  protected readonly pointOptions = [20, 60, 200, 0];
  protected readonly base = signal('');
  protected readonly broker = signal<BrokerState>('disconnected');
  protected readonly device = signal<DeviceState>('unknown');
  protected readonly formError = signal('');
  protected readonly entries = signal<ChannelEntry[]>([]);
  protected readonly discarded = signal(0);
  protected readonly points = signal(60);

  protected readonly channel = computed(() => this.base().split('/').pop() ?? '');
  protected readonly first = computed(() => this.entries()[0] ?? null);
  protected readonly last = computed(() => this.entries().at(-1) ?? null);
  protected readonly secondsAgo = computed(() => {
    const last = this.last();
    return last ? Math.max(0, Math.round((this.now() - Date.parse(last.createdAt)) / 1000)) : null;
  });
  protected readonly recent = computed(() => this.entries().slice(-20).reverse());
  protected readonly stats = computed(() => (['distance', 'level', 'rssi'] as const).map(field => ({ field, stats: fieldStats(this.entries(), field) })));
  protected readonly periodMinutes = computed(() => {
    const first = this.first(), last = this.last();
    return first && last ? (Date.parse(last.createdAt) - Date.parse(first.createdAt)) / 60000 : null;
  });
  protected readonly alarms = computed(() => this.entries().filter(entry => entry.alarm === 1).length);
  protected readonly sends = computed(() => {
    const expected = expectedSends(this.entries()), received = receivedSends(this.entries());
    return expected ? { expected, received, percent: received / expected * 100 } : null;
  });
  private readonly chartOptions: Record<ChannelField, ChartOptions<'line'>> = {
    distance: lineOptions(), level: lineOptions({ min: 0, max: 100 }), rssi: lineOptions(), alarm: lineOptions({ min: 0, max: 1, step: 1 }),
  };
  protected readonly charts = computed<FieldChart[]>(() => {
    const view = this.points() > 0 ? this.entries().slice(-this.points()) : this.entries();
    const labels = view.map(entry => new Date(entry.createdAt).toLocaleTimeString());
    return (['distance', 'level', 'rssi', 'alarm'] as const).map(field => ({
      field, label: `mqtt-monitor.field-${field}`, options: this.chartOptions[field],
      data: { labels, datasets: [{ data: view.map(entry => entry[field]), borderColor: LINE, backgroundColor: LINE, borderWidth: 1.5, pointRadius: 2, tension: 0, stepped: field === 'alarm', spanGaps: false }] },
    }));
  });

  constructor() {
    const timer = setInterval(() => this.now.set(Date.now()), 1000);
    this.destroyRef.onDestroy(() => { clearInterval(timer); this.dialogRef?.close(); this.disconnect(); });
    try {
      const cfg = JSON.parse(localStorage.getItem(CONFIG_KEY) ?? 'null');
      if (typeof cfg?.brokerUrl === 'string' && typeof cfg?.topicBase === 'string') {
        this.brokerUrl = cfg.brokerUrl; this.topicBase = cfg.topicBase;
        void this.connect();
      }
    } catch { /* sin configuración guardada */ }
  }

  protected async connect(): Promise<void> {
    const url = this.brokerUrl.trim(), base = this.topicBase.trim().replace(/\/+$/, '');
    if (!/^wss?:\/\/\S+$/i.test(url)) { this.formError.set('mqtt-monitor.error-broker'); return; }
    if (!base || /[#+\s]/.test(base)) { this.formError.set('mqtt-monitor.error-topic'); return; }
    this.formError.set('');
    this.disconnect();
    const generation = this.generation;
    this.base.set(base);
    this.store(CONFIG_KEY, JSON.stringify({ brokerUrl: url, topicBase: base }));
    this.load();
    this.device.set('unknown');
    this.broker.set('connecting');
    try {
      const { default: mqtt } = await import('mqtt');
      if (generation !== this.generation) return;
      const client = this.client = mqtt.connect(url, {
        clientId: `fulltank_${Math.random().toString(16).slice(2, 10)}`, clean: true, connectTimeout: 5000, reconnectPeriod: 3000,
      });
      const current = () => this.client === client;
      client.on('connect', () => {
        if (!current()) return;
        this.session = Date.now();
        this.broker.set('connected');
        client.subscribe([`${base}/datos`, `${base}/estado`]);
      });
      client.on('reconnect', () => { if (current()) this.broker.set('reconnecting'); });
      client.on('offline', () => { if (current()) this.broker.set('offline'); });
      client.on('error', () => { if (current()) this.broker.set('error'); });
      client.on('message', (topic, message) => {
        if (!current()) return;
        const text = new TextDecoder().decode(message).trim();
        if (topic === `${base}/datos`) this.handleData(text);
        else if (topic === `${base}/estado` && (text === 'online' || text === 'offline')) this.device.set(text);
      });
    } catch { if (generation === this.generation) this.broker.set('error'); }
  }

  protected disconnect(): void {
    this.generation++;
    this.client?.end(true);
    this.client = undefined;
    this.broker.set('disconnected');
  }

  protected exportCsv(): void {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([toCsv(this.entries())], { type: 'text/csv;charset=utf-8' }));
    link.download = `${this.channel() || 'canal'}_datos.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  protected clearHistory(): void {
    if (this.dialogRef || !this.base()) return;
    this.dialogRef = this.dialog.open(ConfirmDialog, { ...CONFIRM_DIALOG_CONFIG, data: { titleKey: 'confirm.title', messageKey: 'mqtt-monitor.confirm-clear' } });
    this.dialogRef.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(confirmed => {
      this.dialogRef = undefined;
      if (confirmed !== true) return;
      this.entries.set([]); this.seen.clear(); this.discarded.set(0);
      this.save();
    });
  }

  private handleData(text: string): void {
    const reading = parseReading(text), key = reading && readingKey(reading);
    if (!reading || (key && this.seen.has(key))) { this.discarded.update(count => count + 1); return; }
    if (key) this.seen.add(key);
    this.entries.set(appendReading(this.entries(), reading, this.session, new Date().toISOString()));
    this.save();
  }

  private load(): void {
    let raw: string | null = null;
    try { raw = localStorage.getItem(STORAGE_PREFIX + this.base()); } catch { /* sin almacenamiento: solo memoria */ }
    const entries = restoreEntries(raw);
    this.seen.clear();
    for (const entry of entries) { const key = readingKey(entry); if (key) this.seen.add(key); }
    this.entries.set(entries);
    this.discarded.set(0);
  }
  private save(): void { this.store(STORAGE_PREFIX + this.base(), JSON.stringify(this.entries())); }
  private store(key: string, value: string): void {
    try { localStorage.setItem(key, value); } catch { /* sin almacenamiento: solo memoria */ }
  }
}
