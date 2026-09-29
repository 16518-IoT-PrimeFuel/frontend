import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { MatButton } from '@angular/material/button';
import { OrderingStore } from '../../../application/ordering.store';

@Component({ selector: 'app-request-list', imports: [CurrencyPipe, RouterLink, DatePipe, FormsModule, TranslatePipe, MatButton], templateUrl: './request-list.html', styleUrl: './request-list.css' })
export class RequestList {
  readonly store = inject(OrderingStore);
  private readonly router = inject(Router);
  readonly status = signal('');
  readonly statuses = ['PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED'];
  readonly counts = computed(() => this.statuses.map(value => ({ value, count: this.store.requests().filter(request => request.status === value).length })).filter(item => item.count > 0));
  readonly filtered = computed(() => this.store.requests().filter(request => !this.status() || request.status === this.status()));
  providerRequestId: number | null = null;
  providerRejectReason = '';
  constructor() { this.store.loadRequests(); this.store.loadNames(); }
  create(): void { this.router.navigate(['/ordering/request-form']).then(); }
  cancel(id: number): void { this.store.cancelRequest(id); }
  acceptById(): void {
    if (this.providerRequestId && this.providerRequestId > 0) this.store.acceptRequest(this.providerRequestId);
  }
  rejectById(): void {
    if (this.providerRequestId && this.providerRequestId > 0 && this.providerRejectReason.trim()) {
      this.store.rejectRequest(this.providerRequestId, this.providerRejectReason.trim());
      this.providerRejectReason = '';
    }
  }
}
