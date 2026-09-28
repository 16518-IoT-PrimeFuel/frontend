import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { MatButton } from '@angular/material/button';
import { MatChip, MatChipSet } from '@angular/material/chips';
import { OrderingStore } from '../../../application/ordering.store';
import { Request } from '../../../domain/model/request.entity';

@Component({ selector: 'app-request-list', imports: [DatePipe, FormsModule, TranslatePipe, MatButton, MatChip, MatChipSet], templateUrl: './request-list.html', styleUrl: './request-list.css' })
export class RequestList {
  readonly store = inject(OrderingStore);
  private readonly router = inject(Router);
  rejectId: number | null = null;
  rejectionReason = '';
  providerRequestId: number | null = null;
  providerRejectReason = '';
  constructor() { this.store.loadRequests(); }
  create(): void { this.router.navigate(['/ordering/request-form']).then(); }
  cancel(id: number): void { this.store.cancelRequest(id); }
  beginReject(id: number): void { this.rejectId = id; this.rejectionReason = ''; }
  reject(): void { if (this.rejectId && this.rejectionReason.trim()) { this.store.rejectRequest(this.rejectId, this.rejectionReason.trim()); this.rejectId = null; } }
  accept(request: Request): void { this.store.acceptRequest(request.id); }
  acceptById(): void {
    if (this.providerRequestId && this.providerRequestId > 0) this.store.acceptRequest(this.providerRequestId);
  }
  rejectById(): void {
    if (this.providerRequestId && this.providerRequestId > 0 && this.providerRejectReason.trim()) {
      this.store.rejectRequest(this.providerRequestId, this.providerRejectReason.trim());
      this.providerRejectReason = '';
    }
  }
  statusClass(status: string): string { return status.toLowerCase(); }
}
