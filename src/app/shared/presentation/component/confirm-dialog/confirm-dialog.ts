import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe } from '@ngx-translate/core';

/** Datos del diálogo: todas las cadenas son claves i18n. */
export interface ConfirmDialogData {
  titleKey: string;
  messageKey: string;
  /** Por defecto `confirm.confirm`. */
  confirmKey?: string;
  /** Si se indica, el diálogo pide un motivo y se cierra con `{ reason }`. */
  reason?: { labelKey: string; required?: boolean; maxLength?: number };
}

/** `false` al cancelar; `true` al confirmar, o `{ reason }` (ya recortado) si se pidió motivo. */
export type ConfirmDialogResult = boolean | { reason: string };

/** Tamaño común: `dialog.open(ConfirmDialog, { ...CONFIRM_DIALOG_CONFIG, data })`. */
export const CONFIRM_DIALOG_CONFIG = { width: '480px', maxWidth: 'calc(100vw - 32px)' };

/**
 * @summary Diálogo de confirmación compartido.
 * @remarks Se abre con `MatDialog.open` y recibe {@link ConfirmDialogData}. Al cerrarse con Escape
 * o fuera del diálogo el resultado es `undefined`: trátalo como cancelación.
 */
@Component({
  selector: 'app-confirm-dialog',
  imports: [FormsModule, TranslatePipe, MatButton, MatDialogModule],
  templateUrl: './confirm-dialog.html',
  styleUrl: './confirm-dialog.css',
})
export class ConfirmDialog {
  protected readonly data = inject<ConfirmDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<ConfirmDialog, ConfirmDialogResult>>(MatDialogRef);
  protected reason = '';

  protected confirm(): void {
    const reason = this.reason.trim();
    if (this.data.reason?.required && !reason) return;
    this.dialogRef.close(this.data.reason ? { reason } : true);
  }
}
