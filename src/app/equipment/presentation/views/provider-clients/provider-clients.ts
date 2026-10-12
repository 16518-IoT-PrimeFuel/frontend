import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter, startWith, Subscription } from 'rxjs';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { ActivatedRoute, NavigationEnd, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';
import { ProviderBuyerCompany } from '../../../domain/model/provider-equipment.entity';
import { ProviderEquipmentApi } from '../../../infrastructure/provider-equipment.api';
import { ProviderBuyerForm } from '../provider-buyer-form/provider-buyer-form';
import { ProviderClientDetail } from '../provider-client-detail/provider-client-detail';

/** Listado de compradores del distribuidor (US-31). El filtro por nombre o RUC es en cliente. /clients/:buyerId abre el detalle como modal sobre este listado. */
@Component({
  selector: 'app-provider-clients',
  standalone: true,
  imports: [RouterLink, MatIconModule, MatButtonModule, MatProgressSpinnerModule, TranslatePipe],
  templateUrl: './provider-clients.html',
  styleUrl: './provider-clients.css',
})
export class ProviderClients {
  private readonly destroyRef = inject(DestroyRef);
  private loadRequest?: Subscription;
  private readonly api = inject(ProviderEquipmentApi);
  private readonly dialog = inject(MatDialog);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private registrationDialog?: MatDialogRef<ProviderBuyerForm, boolean>;
  private detailDialog?: MatDialogRef<ProviderClientDetail>;
  protected readonly buyers = signal<ProviderBuyerCompany[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly search = signal('');
  protected readonly filter = signal<'all' | 'active' | 'critical'>('all');
  protected readonly filters = [
    { id: 'all', label: 'all' }, { id: 'active', label: 'with-active-orders' }, { id: 'critical', label: 'with-critical-tanks' },
  ] as const;
  protected matches(buyer: ProviderBuyerCompany, filter: 'all' | 'active' | 'critical'): boolean {
    return filter === 'all' || (filter === 'active' ? buyer.activeOrderCount > 0 : buyer.criticalTankCount > 0);
  }
  protected count(filter: 'all' | 'active' | 'critical'): number { return this.buyers().filter(buyer => this.matches(buyer, filter)).length; }
  protected readonly rows = computed(() => {
    const q = this.search().trim().toLowerCase();
    return this.buyers().filter(buyer => this.matches(buyer, this.filter()) && (!q || buyer.name.toLowerCase().includes(q) || (buyer.ruc ?? '').includes(q)));
  });
  protected clearFilters(): void { this.search.set(''); this.filter.set('all'); }

  constructor() {
    this.load();
    this.destroyRef.onDestroy(() => { this.registrationDialog?.close(); this.detailDialog?.close(); });
    this.router.events.pipe(filter(e => e instanceof NavigationEnd), startWith(null), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.syncDetail());
  }

  /** El modal de detalle refleja el segmento :buyerId de la URL (enlace directo, atrás/adelante y cierre). */
  private syncDetail(): void {
    const buyerId = this.route.firstChild?.snapshot.paramMap.get('buyerId');
    if (!buyerId) { this.detailDialog?.close(); return; }
    if (this.detailDialog) return;
    this.detailDialog = this.dialog.open(ProviderClientDetail, {
      data: { buyerId }, width: '960px', maxWidth: 'calc(100vw - 32px)', maxHeight: 'calc(100dvh - 32px)', autoFocus: 'dialog',
      ariaLabelledBy: 'client-detail-title',
    });
    this.detailDialog.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.detailDialog = undefined;
      if (this.route.firstChild) void this.router.navigate(['/clients']);
    });
  }

  protected registerBuyer(): void {
    if (this.registrationDialog) return;
    this.registrationDialog = this.dialog.open(ProviderBuyerForm, {
      width: '620px', maxWidth: 'calc(100vw - 32px)', maxHeight: 'calc(100dvh - 32px)',
      ariaLabelledBy: 'buyer-form-title', autoFocus: 'input',
    });
    this.registrationDialog.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(registered => {
      this.registrationDialog = undefined;
      if (registered === true) this.load();
    });
  }

  protected load(): void {
    this.loadRequest?.unsubscribe();
    this.loading.set(true);
    this.error.set(false);
    this.loadRequest = this.api.buyerCompanies().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (rows) => { this.buyers.set(rows); this.loading.set(false); },
      error: () => { this.error.set(true); this.loading.set(false); },
    });
  }

}
