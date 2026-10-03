import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { DatePipe, DecimalPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslatePipe } from '@ngx-translate/core';
import { IamStore } from '../../../../iam/application/iam.store';
import { OrderingApi } from '../../../../ordering/infrastructure/ordering-api';
import { Order } from '../../../../ordering/domain/model/order.entity';
import { ProviderBuyerCompany, ProviderTank } from '../../../domain/model/provider-equipment.entity';
import { ProviderEquipmentApi, unitKey } from '../../../infrastructure/provider-equipment.api';

type Section<T> = { loading: boolean; error: boolean; data: T };

/** Detalle de comprador (US-32): sitios, tanques con dispositivo y pedidos. Cada sección carga y falla por separado. */
@Component({
  selector: 'app-provider-client-detail',
  standalone: true,
  imports: [DatePipe, DecimalPipe, RouterLink, MatButtonModule, MatProgressSpinnerModule, TranslatePipe],
  templateUrl: './provider-client-detail.html',
  styleUrl: '../provider-views.css',
})
export class ProviderClientDetail implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private buyerRequest?: Subscription;
  private tanksRequest?: Subscription;
  private ordersRequest?: Subscription;
  readonly buyerId = inject(ActivatedRoute).snapshot.paramMap.get('buyerId')!;
  private readonly api = inject(ProviderEquipmentApi);
  private readonly ordering = inject(OrderingApi);
  private readonly iam = inject(IamStore);
  protected readonly unitKey = unitKey;

  protected readonly buyer = signal<Section<ProviderBuyerCompany | null>>({ loading: true, error: false, data: null });
  protected readonly tanks = signal<Section<ProviderTank[]>>({ loading: true, error: false, data: [] });
  protected readonly orders = signal<Section<Order[]>>({ loading: true, error: false, data: [] });

  ngOnInit(): void { this.load(); }

  protected load(): void {
    this.buyerRequest?.unsubscribe();
    const id = Number(this.buyerId);
    this.buyer.set({ loading: true, error: false, data: null });
    this.buyerRequest = this.api.buyerCompanies().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (rows) => this.buyer.set({ loading: false, error: false, data: rows.find((b) => b.id === id) ?? null }),
      error: () => this.buyer.set({ loading: false, error: true, data: null }),
    });
    this.loadTanks(id);
    this.loadOrders(id);
  }

  protected loadTanks(id = Number(this.buyerId)): void {
    this.tanksRequest?.unsubscribe();
    this.tanks.set({ loading: true, error: false, data: [] });
    this.tanksRequest = this.api.tanks(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (data) => this.tanks.set({ loading: false, error: false, data }),
      error: () => this.tanks.set({ loading: false, error: true, data: [] }),
    });
  }

  protected loadOrders(id = Number(this.buyerId)): void {
    this.ordersRequest?.unsubscribe();
    const providerId = this.iam.providerId();
    if (!providerId) { this.orders.set({ loading: false, error: true, data: [] }); return; }
    this.orders.set({ loading: true, error: false, data: [] });
    this.ordersRequest = this.ordering.orders('provider', providerId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (rows) => this.orders.set({ loading: false, error: false, data: rows.filter((o) => o.companyId === id) }),
      error: () => this.orders.set({ loading: false, error: true, data: [] }),
    });
  }

  protected device(t: ProviderTank): string { return t.devices.map((d) => `${d.deviceId} (${d.channel})`).join(', '); }
}
