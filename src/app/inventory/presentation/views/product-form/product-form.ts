import { Component, DestroyRef, ElementRef, OnInit, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { InventoryStore } from '../../../application/inventory.store';
import { IamStore } from '../../../../iam/application/iam.store';
import {
  CreateProductPayload,
  UpdateProductPayload,
  FUEL_TYPES
} from '../../../domain/model/fuel-product.entity';

/**
 * @summary Formulario para crear y editar productos de combustible.
 * @remarks Maneja creación y actualización según presencia de productId en ruta.
 * Valida campos obligatorios y formatos numéricos.
 * @author FullTank Platform
 */
@Component({
  selector: 'app-product-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatSlideToggleModule,
    MatProgressSpinnerModule,
    TranslatePipe,
  ],
  templateUrl: './product-form.html',
  styleUrl: './product-form.css',
})
export class ProductForm implements OnInit {
  protected readonly store = inject(InventoryStore);
  private readonly iam = inject(IamStore);
  private readonly syncProduct = effect(() => {
    const product = this.store.selectedProduct();
    if (this.isEditMode && product?.id === this.productId && this.productForm) this.productForm.patchValue(product);
  });
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly translate = inject(TranslateService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected productForm!: FormGroup;
  protected isEditMode = false;
  protected productId: number | null = null;

  protected readonly fuelTypes = FUEL_TYPES.map(value => ({ value, label: 'fuel-type.' + value.toLowerCase() }));

  protected readonly units = [
    { value: 'LITERS', label: 'unit.liters' },
    { value: 'GALLONS', label: 'unit.gallons' },
  ];

  ngOnInit(): void {
    this.store.clearError();
    this.productId = Number(this.route.snapshot.paramMap.get('id')) || null;
    this.isEditMode = !!this.productId;

    this.initForm();

    if (this.isEditMode && this.productId) {
      this.loadProduct(this.productId);
    }
  }

  private initForm(): void {
    this.productForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      fuelType: ['', Validators.required],
      pricePerUnit: [0, [Validators.required, Validators.min(0.01)]],
      unit: ['LITERS', Validators.required],
      availableStock: [0, [Validators.required, Validators.min(0)]],
      capacity: [0, [Validators.required, Validators.min(0.01)]],
      active: [true],
    });
  }

  private loadProduct(productId: number): void {
    this.store.loadProductById(productId);

  }

  protected onSubmit(): void {
    if (this.store.isLoading()) return;
    if (this.productForm.invalid) {
      this.productForm.markAllAsTouched();
      this.host.nativeElement.querySelector<HTMLElement>('[formControlName].ng-invalid')?.focus();
      return;
    }

    if (this.isEditMode && this.productId) {
      this.updateProduct();
    } else {
      this.createProduct();
    }
  }

  private createProduct(): void {
    const providerId = this.iam.providerId();
    if (providerId === null) return;
    const payload: CreateProductPayload = {
      name: this.productForm.value.name,
      fuelType: this.productForm.value.fuelType,
      pricePerUnit: this.productForm.value.pricePerUnit,
      unit: this.productForm.value.unit,
      availableStock: this.productForm.value.availableStock,
      capacity: this.productForm.value.capacity,
      providerId,
      active: true,
    };

    this.store.createProduct(payload, () => {
      if (!this.destroyRef.destroyed) void this.router.navigateByUrl('/fuel-products');
    });
  }

  private updateProduct(): void {
    if (!this.productId) return;

    const payload: UpdateProductPayload = {
      name: this.productForm.value.name,
      fuelType: this.productForm.value.fuelType,
      pricePerUnit: this.productForm.value.pricePerUnit,
      unit: this.productForm.value.unit,
      availableStock: this.productForm.value.availableStock,
      capacity: this.productForm.value.capacity,
      active: this.productForm.value.active,
    };

    this.store.updateProduct(this.productId, payload, () => {
      if (!this.destroyRef.destroyed) void this.router.navigateByUrl('/fuel-products');
    });
  }

  protected onCancel(): void {
    this.router.navigateByUrl('/fuel-products');
  }

  protected getErrorMessage(fieldName: string): string {
    const field = this.productForm.get(fieldName);
    if (!field || !field.errors) return '';

    if (field.errors['required']) return this.translate.instant('validation.required');
    if (field.errors['minlength']) return this.translate.instant('validation.min-length', { n: field.errors['minlength'].requiredLength });
    if (field.errors['min']) return this.translate.instant('validation.min-value', { n: field.errors['min'].min });

    return '';
  }
}
