import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { finalize } from 'rxjs';
import { FulfillmentApi } from '../../../infrastructure/fulfillment-api';
import { Tanker, TankerInput, TankerStatus } from '../../../domain/model/tanker.entity';

@Component({
  selector: 'app-tanker-form', standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatSelectModule, MatIconModule, MatCardModule, MatProgressSpinnerModule, TranslatePipe],
  templateUrl: './tanker-form.html', styleUrl: './tanker-form.css',
})
export class TankerForm implements OnInit {
  private readonly api = inject(FulfillmentApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly loadedTanker = signal<Tanker | null>(null);
  protected isEditMode = false;
  protected tankerId: number | null = null;
  protected readonly statuses: TankerStatus[] = ['AVAILABLE', 'IN_ROUTE', 'MAINTENANCE', 'SUSPENDED', 'INACTIVE'];
  protected readonly units = [{ value: 'LITERS', label: 'unit.liters' }, { value: 'GALLONS', label: 'unit.gallons' }];
  protected readonly tankerForm = this.fb.nonNullable.group({
    licensePlate: ['', [Validators.required, notBlank, Validators.maxLength(20)]],
    brand: ['', [Validators.required, notBlank, Validators.maxLength(80)]],
    model: ['', [Validators.required, notBlank, Validators.maxLength(80)]],
    capacity: [0, [Validators.required, positiveFinite]],
    unit: ['LITERS', [Validators.required, notBlank, Validators.maxLength(20)]],
    status: ['AVAILABLE' as TankerStatus, [Validators.required, (control: AbstractControl) =>
      this.statuses.includes(control.value) ? null : { required: true }]],
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    this.isEditMode = id !== null;
    if (this.isEditMode) {
      const parsed = Number(id);
      if (!Number.isSafeInteger(parsed) || parsed <= 0) {
        this.error.set('tanker-form.invalid-id');
        return;
      }
      this.tankerId = parsed;
      this.loadTanker();
    }
  }

  protected loadTanker(): void {
    if (!this.tankerId || this.loading()) return;
    this.error.set('');
    this.loading.set(true);
    this.api.getTankerById(this.tankerId).pipe(takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loading.set(false))).subscribe({
      next: (tanker) => { this.loadedTanker.set(tanker); this.tankerForm.patchValue(tanker); },
      error: (err) => this.error.set(err.message || 'errors.generic'),
    });
  }

  protected onSubmit(): void {
    if (this.loading() || this.saving() || (this.isEditMode && !this.loadedTanker())) return;
    for (const field of ['licensePlate', 'brand', 'model', 'unit'] as const) {
      const control = this.tankerForm.controls[field];
      control.setValue(control.value.trim());
    }
    if (this.tankerForm.invalid) { this.tankerForm.markAllAsTouched(); return; }
    const request: TankerInput = this.tankerForm.getRawValue();
    this.saving.set(true);
    this.error.set('');
    this.tankerForm.disable();
    const operation = this.isEditMode ? this.api.updateTanker(this.tankerId!, request) : this.api.registerTanker(request);
    operation.pipe(takeUntilDestroyed(this.destroyRef), finalize(() => {
      this.saving.set(false); this.tankerForm.enable();
    })).subscribe({
      next: () => this.router.navigate(['/fulfillment/tanker-list']),
      error: (err) => this.error.set(err.message || 'errors.generic'),
    });
  }

  protected onCancel(): void { this.router.navigate(['/fulfillment/tanker-list']); }

  protected getErrorMessage(field: string): string {
    const control = this.tankerForm.get(field);
    if (control?.hasError('required')) return this.translate.instant('validation.required');
    if (control?.hasError('maxlength')) return this.translate.instant('validation.max-length', { n: control.errors?.['maxlength'].requiredLength });
    if (control?.hasError('positive')) return this.translate.instant('validation.positive');
    return '';
  }
}

function notBlank(control: AbstractControl) { return typeof control.value === 'string' && control.value.trim() ? null : { required: true }; }
function positiveFinite(control: AbstractControl) { return typeof control.value === 'number' && Number.isFinite(control.value) && control.value > 0 ? null : { positive: true }; }
