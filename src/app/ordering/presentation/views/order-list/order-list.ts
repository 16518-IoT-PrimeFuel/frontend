import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { MatButton } from '@angular/material/button';
import { MatChip, MatChipSet } from '@angular/material/chips';
import { FormsModule } from '@angular/forms';
import { MatFormField, MatInput, MatLabel } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import { OrderingStore } from '../../../application/ordering.store';

@Component({ selector: 'app-order-list', imports: [CurrencyPipe, FormsModule, TranslatePipe, MatButton, MatChip, MatChipSet, MatFormField, MatInput, MatLabel, MatSelect, MatOption], templateUrl: './order-list.html', styleUrl: './order-list.css' })
export class OrderList {
  readonly store = inject(OrderingStore);
  private readonly router = inject(Router);
  readonly search = signal('');
  readonly status = signal('');
  readonly filtered = computed(() => this.store.orders().filter(order => (!this.search() || String(order.id).includes(this.search().trim())) && (!this.status() || order.status === this.status())));
  readonly statuses = ['PENDING', 'CONFIRMED', 'DISPATCHED', 'PENDING_PAYMENT', 'PAID', 'CANCELLED'];
  constructor() { this.store.loadOrders(); }
  open(id: number): void { this.router.navigate(['/ordering/order-detail', id]).then(); }
}
