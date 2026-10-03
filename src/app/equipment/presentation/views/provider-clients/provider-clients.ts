import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslatePipe } from '@ngx-translate/core';
import { ProviderBuyerCompany } from '../../../domain/model/provider-equipment.entity';
import { ProviderEquipmentApi } from '../../../infrastructure/provider-equipment.api';

/** Listado de compradores del distribuidor (US-31). El filtro por nombre o RUC es en cliente. */
@Component({
  selector: 'app-provider-clients',
  standalone: true,
  imports: [RouterLink, MatButtonModule, MatProgressSpinnerModule, TranslatePipe],
  templateUrl: './provider-clients.html',
  styleUrl: '../provider-views.css',
})
export class ProviderClients {
  private readonly destroyRef = inject(DestroyRef);
  private loadRequest?: Subscription;
  private readonly api = inject(ProviderEquipmentApi);
  private readonly router = inject(Router);
  protected readonly buyers = signal<ProviderBuyerCompany[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly search = signal('');
  protected readonly rows = computed(() => {
    const q = this.search().trim().toLowerCase();
    return q ? this.buyers().filter((b) => b.name.toLowerCase().includes(q) || (b.ruc ?? '').includes(q)) : this.buyers();
  });

  constructor() { this.load(); }

  protected load(): void {
    this.loadRequest?.unsubscribe();
    this.loading.set(true);
    this.error.set(false);
    this.loadRequest = this.api.buyerCompanies().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (rows) => { this.buyers.set(rows); this.loading.set(false); },
      error: () => { this.error.set(true); this.loading.set(false); },
    });
  }

  protected open(id: number): void { this.router.navigate(['/clients', id]); }
}
