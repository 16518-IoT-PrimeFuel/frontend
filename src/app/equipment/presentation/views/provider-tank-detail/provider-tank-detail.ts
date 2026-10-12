import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, Subscription } from 'rxjs';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';
import { ChartData, ChartOptions } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { RefillEpisode } from '../../../domain/model/equipment.entity';
import { DeviceCredential, ProviderTank, ProviderTankReading } from '../../../domain/model/provider-equipment.entity';
import { ProviderEquipmentApi, unitKey } from '../../../infrastructure/provider-equipment.api';
import { FormsModule } from '@angular/forms';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { CONFIRM_DIALOG_CONFIG, ConfirmDialog } from '../../../../shared/presentation/component/confirm-dialog/confirm-dialog';
import { apiErrorKey } from '../../../../shared/infrastructure/api-error';
import { LimaDatePipe } from '../../../../shared/presentation/pipe/lima-date.pipe';

type Section<T> = { loading: boolean; error: boolean; data: T };

const HOUR = 3_600_000;
const READINGS_WINDOW_HOURS = 48;
const STALE_AFTER_HOURS = 1;

/** Detalle de tanque del distribuidor (US-32, US-52): nivel, lecturas y episodios. Cada sección falla por separado. */
@Component({
  selector: 'app-provider-tank-detail',
  standalone: true,
  imports: [MatTabsModule, MatIconModule, FormsModule, LimaDatePipe, BaseChartDirective, DecimalPipe, RouterLink, MatButtonModule, MatProgressSpinnerModule, TranslatePipe],
  templateUrl: './provider-tank-detail.html',
  styleUrl: './provider-tank-detail.css',
})
export class ProviderTankDetail implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private tankRequest?: Subscription;
  private readingsRequest?: Subscription;
  private episodesRequest?: Subscription;
  readonly tankId = Number(inject(ActivatedRoute).snapshot.paramMap.get('id'));
  private readonly api = inject(ProviderEquipmentApi);
  private readonly dialog = inject(MatDialog);
  private credentialDialog?: MatDialogRef<unknown>;
  protected credentialOpen = false;
  protected channel = '';
  protected readonly credential = signal<Omit<DeviceCredential, 'token'> | null>(null);
  protected readonly deviceToken = signal('');
  protected readonly credentialBusy = signal(false);
  protected readonly credentialError = signal('');
  protected readonly credentialNotice = signal('');
  private readonly now = signal(Date.now());
  private readonly date = new LimaDatePipe();
  protected readonly unitKey = unitKey;

  protected readonly tank = signal<Section<ProviderTank | null>>({ loading: true, error: false, data: null });
  protected readonly readings = signal<Section<ProviderTankReading[]>>({ loading: true, error: false, data: [] });
  protected readonly episodes = signal<Section<RefillEpisode[]>>({ loading: true, error: false, data: [] });

  protected readonly last = computed(() => this.readings().data.at(-1) ?? null);
  /** Minutos desde la última lectura; null si no hay. */
  protected readonly ageMinutes = computed(() => {
    const l = this.last();
    return l ? Math.max(0, Math.floor((this.now() - new Date(l.capturedAt).getTime()) / 60_000)) : null;
  });
  protected readonly stale = computed(() => (this.ageMinutes() ?? 0) > STALE_AFTER_HOURS * 60);

  protected readonly chartData = computed<ChartData<'line', number[], string>>(() => ({
    labels: this.readings().data.map((r) => this.date.transform(r.capturedAt)),
    datasets: [{ data: this.readings().data.map((r) => r.level), borderColor: '#2980b9', pointRadius: 2, tension: 0.2 }],
  }));
  protected readonly chartOptions: ChartOptions<'line'> = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } };
  protected readonly reversed = computed(() => this.readings().data.slice().reverse());
  protected readonly percent = computed(() => {
    const tank = this.tank().data;
    return tank && tank.capacity > 0 ? Math.min(100, Math.max(0, Math.round(tank.currentLevel / tank.capacity * 100))) : 0;
  });
  protected readonly freeSpace = computed(() => Math.max(0, (this.tank().data?.capacity ?? 0) - (this.tank().data?.currentLevel ?? 0)));

  protected changeTab(): void { this.credentialOpen = false; this.deviceToken.set(''); }

  constructor() {
    const timer = setInterval(() => this.now.set(Date.now()), 60_000);
    this.destroyRef.onDestroy(() => clearInterval(timer));
    this.destroyRef.onDestroy(() => { this.credentialDialog?.close(); this.deviceToken.set(''); });
  }

  protected toggleCredential(event: Event): void {
    this.credentialOpen = (event.target as HTMLDetailsElement).open;
    if (!this.credentialOpen) this.deviceToken.set('');
  }

  protected changeChannel(): void {
    this.deviceToken.set(''); this.credential.set(null); this.credentialError.set(''); this.credentialNotice.set('');
  }

  protected manageCredential(action: 'issue' | 'rotate' | 'revoke'): void {
    const channel = this.channel;
    if (this.credentialBusy() || this.credentialDialog || !Number.isSafeInteger(this.tankId) || this.tankId < 1
      || !this.tank().data?.devices.some(device => device.channel === channel)) return;
    if (action === 'issue') { this.sendCredential(action, channel); return; }
    this.credentialDialog = this.dialog.open(ConfirmDialog, { ...CONFIRM_DIALOG_CONFIG, data: {
      titleKey: `device.${action}`, messageKey: `device.confirm-${action}`,
    } });
    this.credentialDialog.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(confirmed => {
      this.credentialDialog = undefined;
      if (confirmed === true && !this.credentialBusy() && this.channel === channel && this.tank().data?.devices.some(device => device.channel === channel)) this.sendCredential(action, channel);
    });
  }

  private sendCredential(action: 'issue' | 'rotate' | 'revoke', channel: string): void {
    this.credentialBusy.set(true);
    this.changeChannel();
    const request = action === 'issue' ? this.api.issueDeviceCredential(this.tankId, channel)
      : action === 'rotate' ? this.api.rotateDeviceCredential(this.tankId, channel) : this.api.revokeDeviceCredential(this.tankId, channel);
    request.pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.credentialBusy.set(false))).subscribe({
      next: ({ token, ...credential }) => {
        if (this.channel !== channel) return;
        if (credential.tankId !== this.tankId || credential.channel !== channel) { this.credentialError.set('errors.generic'); return; }
        this.credential.set(credential);
        this.deviceToken.set(this.credentialOpen && typeof token === 'string' ? token : '');
        this.credentialNotice.set(`device.${action}-success`);
      },
      error: error => {
        if (this.channel !== channel) return;
        this.credentialError.set(apiErrorKey(error));
      },
    });
  }

  protected async copyToken(): Promise<void> {
    const token = this.deviceToken();
    if (!token) return;
    try { await navigator.clipboard.writeText(token); if (this.deviceToken() === token) this.credentialNotice.set('device.copied'); }
    catch { if (this.deviceToken() === token) this.credentialError.set('device.copy-error'); }
  }

  ngOnInit(): void { this.loadTank(); this.loadReadings(); this.loadEpisodes(); }

  protected loadTank(): void {
    this.tankRequest?.unsubscribe();
    this.tank.set({ loading: true, error: false, data: null });
    this.changeChannel();
    this.tankRequest = this.api.tank(this.tankId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (data) => { this.tank.set({ loading: false, error: false, data }); this.channel = data?.devices?.[0]?.channel ?? ''; },
      // 404 TANK_NOT_FOUND (inexistente, inactivo o ajeno) => "no encontrado"; el resto => reintento.
      error: (e) => this.tank.set({ loading: false, error: e?.error?.code !== 'TANK_NOT_FOUND', data: null }),
    });
  }

  protected loadReadings(): void {
    this.readingsRequest?.unsubscribe();
    this.readings.set({ loading: true, error: false, data: [] });
    const from = new Date(Date.now() - READINGS_WINDOW_HOURS * HOUR).toISOString();
    this.readingsRequest = this.api.readings(this.tankId, from).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (data) => this.readings.set({ loading: false, error: false, data }),
      error: () => this.readings.set({ loading: false, error: true, data: [] }),
    });
  }

  protected loadEpisodes(): void {
    this.episodesRequest?.unsubscribe();
    this.episodes.set({ loading: true, error: false, data: [] });
    this.episodesRequest = this.api.episodes(this.tankId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (data) => this.episodes.set({ loading: false, error: false, data }),
      error: () => this.episodes.set({ loading: false, error: true, data: [] }),
    });
  }
}
