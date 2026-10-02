import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslatePipe } from '@ngx-translate/core';
import { FulfillmentStore } from '../../../application/fulfillment.store';
import { ProviderDelivery } from '../../../domain/model/provider-delivery.entity';

/** Fecha de negocio de hoy (yyyy-MM-dd) en America/Lima, no en UTC. */
const todayLima = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });

/**
 * @summary Lista de entregas del distribuidor ("Entregas de hoy").
 * @remarks La fecha se filtra en el backend; estado, conductor y cisterna en el cliente.
 */
@Component({
  selector: 'app-delivery-list',
  standalone: true,
  imports: [DatePipe, RouterLink, MatIconModule, MatButtonModule, MatProgressSpinnerModule, TranslatePipe],
  templateUrl: './delivery-list.html',
  styleUrl: './delivery-list.css',
})
export class DeliveryList implements OnInit {
  protected readonly store = inject(FulfillmentStore);
  protected readonly date = signal<string>(todayLima());
  protected readonly state = signal('');
  protected readonly driverId = signal('');
  protected readonly tankerId = signal('');

  protected readonly states = computed(() => [...new Set(this.store.deliveries().map((d) => d.physicalState))]);
  protected readonly drivers = computed(() => this.unique(this.store.deliveries().flatMap((d) => d.driver ? [[d.driver.id, `${d.driver.firstName} ${d.driver.lastName}`] as const] : [])));
  protected readonly tankers = computed(() => this.unique(this.store.deliveries().flatMap((d) => d.tanker ? [[d.tanker.id, d.tanker.licensePlate] as const] : [])));

  protected readonly rows = computed(() =>
    this.store.deliveries().filter((d) =>
      (!this.state() || d.physicalState === this.state()) &&
      (!this.driverId() || String(d.driver?.id) === this.driverId()) &&
      (!this.tankerId() || String(d.tanker?.id) === this.tankerId())));

  protected readonly hasFilters = computed(() => !!(this.state() || this.driverId() || this.tankerId()));

  ngOnInit(): void { this.load(); }

  protected load(): void { this.store.loadDeliveries(this.date() || undefined); }

  protected setDate(value: string): void { this.date.set(value); this.clearFilters(); this.load(); }

  protected toggleAll(): void { this.setDate(this.date() ? '' : todayLima()); }

  protected clearFilters(): void { this.state.set(''); this.driverId.set(''); this.tankerId.set(''); }

  protected driverName(d: ProviderDelivery): string { return d.driver ? `${d.driver.firstName} ${d.driver.lastName}` : '-'; }

  /** LITRE|LITERS -> unit.liters, GALLON|GALLONS -> unit.gallons. */
  protected unitKey(unit: string | null): string { return unit?.startsWith('GALLON') ? 'unit.gallons' : 'unit.liters'; }

  private unique(pairs: (readonly [number, string])[]): { id: string; label: string }[] {
    return [...new Map(pairs).entries()].map(([id, label]) => ({ id: String(id), label }));
  }
}
