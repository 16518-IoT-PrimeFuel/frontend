import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslatePipe } from '@ngx-translate/core';
import { ChartData, ChartOptions } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { RefillEpisode } from '../../../domain/model/equipment.entity';
import { ProviderTank, ProviderTankReading } from '../../../domain/model/provider-equipment.entity';
import { ProviderEquipmentApi, unitKey } from '../../../infrastructure/provider-equipment.api';

type Section<T> = { loading: boolean; error: boolean; data: T };

const HOUR = 3_600_000;
const READINGS_WINDOW_HOURS = 48;
const STALE_AFTER_HOURS = 1;

/** Detalle de tanque del distribuidor (US-32, US-52): nivel, lecturas y episodios. Cada sección falla por separado. */
@Component({
  selector: 'app-provider-tank-detail',
  standalone: true,
  imports: [BaseChartDirective, DatePipe, DecimalPipe, RouterLink, MatButtonModule, MatProgressSpinnerModule, TranslatePipe],
  templateUrl: './provider-tank-detail.html',
  styleUrl: './provider-tank-detail.css',
})
export class ProviderTankDetail implements OnInit {
  readonly tankId = Number(inject(ActivatedRoute).snapshot.paramMap.get('id'));
  private readonly api = inject(ProviderEquipmentApi);
  protected readonly unitKey = unitKey;

  protected readonly tank = signal<Section<ProviderTank | null>>({ loading: true, error: false, data: null });
  protected readonly readings = signal<Section<ProviderTankReading[]>>({ loading: true, error: false, data: [] });
  protected readonly episodes = signal<Section<RefillEpisode[]>>({ loading: true, error: false, data: [] });

  protected readonly last = computed(() => this.readings().data.at(-1) ?? null);
  /** Minutos desde la última lectura; null si no hay. */
  protected readonly ageMinutes = computed(() => {
    const l = this.last();
    return l ? Math.max(0, Math.round((Date.now() - new Date(l.capturedAt).getTime()) / 60_000)) : null;
  });
  protected readonly stale = computed(() => (this.ageMinutes() ?? 0) > STALE_AFTER_HOURS * 60);

  protected readonly chartData = computed<ChartData<'line', number[], string>>(() => ({
    labels: this.readings().data.map((r) => new Date(r.capturedAt).toLocaleString()),
    datasets: [{ data: this.readings().data.map((r) => r.level), borderColor: '#2980b9', pointRadius: 2, tension: 0.2 }],
  }));
  protected readonly chartOptions: ChartOptions<'line'> = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } };
  protected readonly reversed = computed(() => this.readings().data.slice().reverse());

  ngOnInit(): void { this.loadTank(); this.loadReadings(); this.loadEpisodes(); }

  protected loadTank(): void {
    this.tank.set({ loading: true, error: false, data: null });
    this.api.tank(this.tankId).subscribe({
      next: (data) => this.tank.set({ loading: false, error: false, data }),
      // 404 TANK_NOT_FOUND (inexistente, inactivo o ajeno) => "no encontrado"; el resto => reintento.
      error: (e) => this.tank.set({ loading: false, error: e?.error?.code !== 'TANK_NOT_FOUND', data: null }),
    });
  }

  protected loadReadings(): void {
    this.readings.set({ loading: true, error: false, data: [] });
    const from = new Date(Date.now() - READINGS_WINDOW_HOURS * HOUR).toISOString();
    this.api.readings(this.tankId, from).subscribe({
      next: (data) => this.readings.set({ loading: false, error: false, data }),
      error: () => this.readings.set({ loading: false, error: true, data: [] }),
    });
  }

  protected loadEpisodes(): void {
    this.episodes.set({ loading: true, error: false, data: [] });
    this.api.episodes(this.tankId).subscribe({
      next: (data) => this.episodes.set({ loading: false, error: false, data }),
      error: () => this.episodes.set({ loading: false, error: true, data: [] }),
    });
  }
}
