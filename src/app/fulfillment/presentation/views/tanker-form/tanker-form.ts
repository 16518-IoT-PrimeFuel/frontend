import { Component, OnInit, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslatePipe } from '@ngx-translate/core';
import { FulfillmentStore } from '../../../application/fulfillment.store';
import { Tanker } from '../../../domain/model/tanker.entity';
@Component({
  selector: 'app-tanker-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSelectModule,
    MatIconModule,
    MatCardModule,
    MatProgressSpinnerModule,
    TranslatePipe,
  ],
  templateUrl: './tanker-form.html',
  styleUrl: './tanker-form.css',
})
export class TankerForm implements OnInit {
  protected readonly store = inject(FulfillmentStore);
  private readonly syncForm = effect(() => {
    const tanker = this.store.selectedTanker();
    if (tanker && this.tankerForm) this.tankerForm.patchValue(tanker);
  });
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);


  protected tankerForm: FormGroup;
  protected isEditMode = false;
  protected tankerId: number | null = null;

  protected readonly statuses = ['AVAILABLE', 'IN_ROUTE', 'MAINTENANCE', 'SUSPENDED', 'INACTIVE'];

  protected readonly units = [
    { value: 'LITERS', label: 'unit.liters' },
    { value: 'GALLONS', label: 'unit.gallons' },
  ];

  constructor() {
    this.tankerForm = this.fb.group({
      licensePlate: ['', [Validators.required, Validators.minLength(6)]],
      brand: ['', [Validators.required, Validators.minLength(2)]],
      model: ['', [Validators.required, Validators.minLength(2)]],
      capacity: [0, [Validators.required, Validators.min(1)]],
      unit: ['LITERS', Validators.required],
      status: ['AVAILABLE', Validators.required],
    });
  }

  ngOnInit(): void {
    this.tankerId = Number(this.route.snapshot.paramMap.get('id')) || null;
    this.isEditMode = !!this.tankerId;

    if (this.isEditMode && this.tankerId) {
      this.store.loadTankerById(this.tankerId);
    }
  }

  protected onSubmit(): void {
    if (this.tankerForm.invalid) {
      this.tankerForm.markAllAsTouched();
      return;
    }
    if (this.isEditMode && this.tankerId) {
      this.updateTankerData();
    } else {
      this.registerTankerData();
    }
  }

  private registerTankerData(): void {
    const request: Omit<Tanker, 'id' | 'providerId' | 'createdAt'> = {
      licensePlate: this.tankerForm.value.licensePlate,
      brand: this.tankerForm.value.brand,
      model: this.tankerForm.value.model,
      capacity: this.tankerForm.value.capacity,
      unit: this.tankerForm.value.unit,
      status: 'AVAILABLE',
      active: true,
    };
    this.store.registerTanker(request, () => {
      this.router.navigate(['/fulfillment/tanker-list']);
    });
  }

  private updateTankerData(): void {
    const request: Partial<Omit<Tanker, 'id' | 'providerId' | 'createdAt'>> = {
      licensePlate: this.tankerForm.value.licensePlate,
      brand: this.tankerForm.value.brand,
      model: this.tankerForm.value.model,
      capacity: this.tankerForm.value.capacity,
      unit: this.tankerForm.value.unit,
      status: this.tankerForm.value.status,
    };
    this.store.updateTanker(this.tankerId!, request, () => {
      this.router.navigate(['/fulfillment/tanker-list']);
    });
  }

  protected onCancel(): void {
    this.router.navigate(['/fulfillment/tanker-list']);
  }

  protected getErrorMessage(field: string): string {
    const control = this.tankerForm.get(field);
    if (control?.hasError('required')) return 'This field is required';
    if (control?.hasError('minlength'))
      return `Minimum length is ${control.errors?.['minlength'].requiredLength}`;
    if (control?.hasError('min')) return 'Value must be greater than 0';
    return '';
  }
}
