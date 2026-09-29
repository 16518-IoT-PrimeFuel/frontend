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
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { FulfillmentStore } from '../../../application/fulfillment.store';
import { Driver } from '../../../domain/model/driver.entity';
@Component({
  selector: 'app-driver-form',
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
  templateUrl: './driver-form.html',
  styleUrl: './driver-form.css',
})
export class DriverForm implements OnInit {
  protected readonly store = inject(FulfillmentStore);
  private readonly syncForm = effect(() => {
    const driver = this.store.selectedDriver();
    if (driver && this.driverForm) this.driverForm.patchValue(driver);
  });
  private readonly fb = inject(FormBuilder);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);


  protected driverForm: FormGroup;
  protected isEditMode = false;
  protected driverId: number | null = null;
  protected readonly statuses = ['AVAILABLE', 'ASSIGNED', 'SUSPENDED', 'INACTIVE'];

  constructor() {
    this.driverForm = this.fb.group({
      userId: [null],
      status: ['AVAILABLE'],
      firstName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80)]],
      lastName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80)]],
      licenseNumber: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(60)]],
      phoneNumber: ['', [Validators.required, Validators.pattern(/^\+?[0-9]{9,15}$/)]],
      email: ['', [Validators.required, Validators.email, Validators.maxLength(160)]],
    });
  }

  ngOnInit(): void {
    this.store.clearMessages();
    this.driverId = Number(this.route.snapshot.paramMap.get('id')) || null;
    this.isEditMode = !!this.driverId;

    if (this.isEditMode && this.driverId) {
      this.store.loadDriverById(this.driverId);
    }
  }

  protected onSubmit(): void {
    if (this.driverForm.invalid) {
      this.driverForm.markAllAsTouched();
      return;
    }
    if (this.isEditMode && this.driverId) {
      this.updateDriverData();
    } else {
      this.registerDriverData();
    }
  }

  private registerDriverData(): void {
    const request: Omit<Driver, 'id' | 'providerId' | 'createdAt'> = {
      userId: this.driverForm.value.userId,
      firstName: this.driverForm.value.firstName,
      lastName: this.driverForm.value.lastName,
      licenseNumber: this.driverForm.value.licenseNumber,
      phoneNumber: this.driverForm.value.phoneNumber,
      email: this.driverForm.value.email,
      status: 'AVAILABLE',
      active: true,
    };
    this.store.registerDriver(request, () => {
      this.router.navigate(['/fulfillment/driver-list']);
    });
  }

  private updateDriverData(): void {
    const request: Partial<Omit<Driver, 'id' | 'providerId' | 'createdAt'>> = {
      userId: this.driverForm.value.userId,
      status: this.driverForm.value.status,
      firstName: this.driverForm.value.firstName,
      lastName: this.driverForm.value.lastName,
      licenseNumber: this.driverForm.value.licenseNumber,
      phoneNumber: this.driverForm.value.phoneNumber,
      email: this.driverForm.value.email,
    };
    this.store.updateDriver(this.driverId!, request, () => {
      this.router.navigate(['/fulfillment/driver-list']);
    });
  }

  protected onCancel(): void {
    this.router.navigate(['/fulfillment/driver-list']);
  }

  protected getErrorMessage(field: string): string {
    const control = this.driverForm.get(field);
    if (control?.hasError('required')) return this.translate.instant('validation.required');
    if (control?.hasError('minlength')) return this.translate.instant('validation.min-length', { n: control.errors?.['minlength'].requiredLength });
    if (control?.hasError('maxlength')) return this.translate.instant('validation.max-length', { n: control.errors?.['maxlength'].requiredLength });
    if (control?.hasError('email')) return this.translate.instant('validation.email');
    if (control?.hasError('pattern')) return this.translate.instant('validation.phone');
    return '';
  }
}
