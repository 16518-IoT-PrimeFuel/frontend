import { Component, ElementRef, OnInit, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { InventoryStore } from '../../../application/inventory.store';
import { IamStore } from '../../../../iam/application/iam.store';
import {
  CreateProductPayload,
  UpdateProductPayload,
  FuelProduct,
  FUEL_TYPES
} from '../../../domain/model/fuel-product.entity';

/**
 * @summary Formulario modal para crear y editar productos de combustible.
 * @remarks Edita cuando recibe `data.product`; si no, crea. Cierra el modal al guardar.
 * @author FullTank Platform
 */
@Component({
  selector: 'app-product-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatSlideToggleModule,
    TranslatePipe,
  ],
  templateUrl: './product-form.html',
  styleUrl: './product-form.css',
})
export class ProductForm implements OnInit {
  protected readonly store = inject(InventoryStore);
  private readonly iam = inject(IamStore);
  private readonly fb = inject(FormBuilder);
  private readonly translate = inject(TranslateService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly dialogRef = inject<MatDialogRef<ProductForm, boolean>>(MatDialogRef, { optional: true });
  private readonly product = inject<{ product?: FuelProduct } | null>(MAT_DIALOG_DATA, { optional: true })?.product ?? null;

  protected productForm!: FormGroup;
  protected readonly isEditMode = this.product !== null;
  protected readonly productId = this.product?.id ?? null;

  protected readonly fuelTypes = FUEL_TYPES.map(value => ({ value, label: 'fuel-type.' + value.toLowerCase() }));

  protected readonly units = [
    { value: 'LITRE', label: 'unit.liters' },
    { value: 'GALLON', label: 'unit.gallons' },
  ];

  /** No se puede cerrar con Escape o clic fuera mientras se guarda. */
  private readonly lockClose = effect(() => { if (this.dialogRef) this.dialogRef.disableClose = this.store.isLoading(); });

  ngOnInit(): void {
    this.store.clearError();
    this.initForm();
    if (this.product) this.productForm.patchValue(this.product);
  }

  private initForm(): void {
    this.productForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      fuelType: ['', Validators.required],
      pricePerUnit: [0, [Validators.required, Validators.min(0.01)]],
      unit: ['LITRE', Validators.required],
      availableStock: [0, [Validators.required, Validators.min(0)]],
      capacity: [0, [Validators.required, Validators.min(0.01)]],
      active: [true],
    });
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

    this.store.createProduct(payload, () => this.dialogRef?.close(true));
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

    this.store.updateProduct(this.productId, payload, () => this.dialogRef?.close(true));
  }

  protected onCancel(): void {
    this.dialogRef?.close(false);
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
