import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { MatButton } from '@angular/material/button';
import { FormsModule } from '@angular/forms';
import { MatFormField, MatInput, MatLabel } from '@angular/material/input';
import { OrderingStore } from '../../../application/ordering.store';

@Component({ selector: 'app-order-list', imports: [CurrencyPipe, RouterLink, FormsModule, TranslatePipe, MatButton, MatFormField, MatInput, MatLabel], templateUrl: './order-list.html', styleUrl: './order-list.css' })
export class OrderList {
  readonly store = inject(OrderingStore);
  private readonly router = inject(Router);
  readonly search = signal('');
  readonly status = signal('');
  readonly statuses = ['PENDING', 'CONFIRMED', 'DISPATCHED', 'PENDING_PAYMENT', 'PAID', 'IN_PROGRESS', 'DELIVERED', 'CANCELLED'];
  readonly counts = computed(() => this.statuses.map(value => ({ value, count: this.store.orders().filter(order => order.status === value).length })).filter(item => item.count > 0));
  readonly filtered = computed(() => this.store.orders().filter(order => (!this.search() || String(order.id).includes(this.search().trim())) && (!this.status() || order.status === this.status())));
  constructor() { this.store.loadOrders(); this.store.loadNames(); }
  open(id: number): void { this.router.navigate(['/ordering/order-detail', id]).then(); }
  clear(): void { this.search.set(''); this.status.set(''); }
}
