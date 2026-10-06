import { Component, computed, inject, signal, TemplateRef, ViewChild } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { MatButton } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormField, MatInput, MatLabel } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { AdminStore } from '../../../application/admin.store';
import { AdminUser } from '../../../infrastructure/admin-api';

@Component({
  selector: 'app-admin-panel',
  imports: [CurrencyPipe, DatePipe, FormsModule, TranslatePipe, MatButton, MatDialogModule, MatFormField, MatInput, MatLabel, MatSelect, MatOption, MatTabsModule, MatTableModule],
  templateUrl: './admin-panel.html',
  styleUrl: './admin-panel.css',
})
export class AdminPanel {
  readonly store = inject(AdminStore);
  private readonly dialog = inject(MatDialog);
  @ViewChild('promoteDialog') promoteDialog!: TemplateRef<unknown>;
  @ViewChild('deleteDialog') deleteDialog!: TemplateRef<unknown>;

  readonly search = signal('');
  readonly version = signal('v1');
  readonly paymentStatus = signal('');
  readonly deliveryId = signal('');
  readonly confirmId = signal('');
  readonly candidate = signal<AdminUser | null>(null);
  private confirming = false;
  readonly users = computed(() => this.store.users().filter(user => user.username.toLowerCase().includes(this.search().trim().toLowerCase())));
  readonly statuses = computed(() => [...new Set(this.store.payments().map(payment => payment.status))]);
  readonly payments = computed(() => this.store.payments().filter(payment => !this.paymentStatus() || payment.status === this.paymentStatus()));
  readonly validDelivery = computed(() => /^\d+$/.test(this.deliveryId().trim()));
  readonly userColumns = ['id', 'username', 'roles', 'company', 'provider', 'actions'];
  readonly metricColumns = ['routeKey', 'handler', 'count', 'lastSeen', 'distinctCallers'];
  readonly paymentColumns = ['id', 'orderId', 'companyId', 'amount', 'status', 'paymentMethod', 'transactionReference', 'paidAt'];

  constructor() { this.store.loadUsers(); this.store.loadMetrics(this.version()); this.store.loadPayments(); }

  isAdmin(user: AdminUser): boolean { return user.roles.includes('ROLE_ADMIN'); }
  setVersion(version: string): void { this.version.set(version); this.store.loadMetrics(version); }

  askPromote(user: AdminUser): void {
    if (this.confirming || this.store.acting()) return;
    this.confirming = true;
    this.candidate.set(user);
    this.dialog.open(this.promoteDialog).afterClosed().subscribe(ok => { this.confirming = false; if (ok) this.store.promote(user); });
  }

  export(): void {
    const id = Number(this.deliveryId());
    this.store.exportEvidence(id, evidence => {
      const url = URL.createObjectURL(new Blob([JSON.stringify(evidence, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url; link.download = `transport-evidence-${id}.json`; link.click();
      URL.revokeObjectURL(url);
    });
  }

  askDelete(): void {
    if (this.confirming || this.store.acting()) return;
    this.confirming = true;
    this.confirmId.set('');
    this.dialog.open(this.deleteDialog).afterClosed().subscribe(ok => { this.confirming = false; if (ok) this.store.deleteEvidence(Number(this.deliveryId())); });
  }
}
