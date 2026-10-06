import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslateModule } from '@ngx-translate/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmDialog, ConfirmDialogData } from './confirm-dialog';

describe('ConfirmDialog', () => {
  const setup = (data: ConfirmDialogData) => {
    const close = vi.fn();
    TestBed.configureTestingModule({ imports: [ConfirmDialog, TranslateModule.forRoot()], providers: [
      { provide: MAT_DIALOG_DATA, useValue: data }, { provide: MatDialogRef, useValue: { close } },
    ] });
    const fixture = TestBed.createComponent(ConfirmDialog);
    fixture.detectChanges();
    const buttons: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('button'));
    return { fixture, close, cancel: buttons[0], confirm: buttons[1] };
  };
  beforeEach(() => TestBed.resetTestingModule());

  it('closes with false when cancelled', () => {
    const { close, cancel } = setup({ titleKey: 'confirm.title', messageKey: 'order-detail.confirm-cancel' });
    cancel.click();
    expect(close).toHaveBeenCalledExactlyOnceWith(false);
  });

  it('shows the given keys and closes with true when confirmed', () => {
    const { fixture, close, confirm } = setup({ titleKey: 'confirm.title', messageKey: 'order-detail.confirm-cancel', confirmKey: 'order-detail.cancel' });
    expect(fixture.nativeElement.textContent).toContain('confirm.title');
    expect(fixture.nativeElement.textContent).toContain('order-detail.confirm-cancel');
    expect(confirm.textContent).toContain('order-detail.cancel');
    expect(fixture.nativeElement.querySelector('textarea')).toBeNull();
    confirm.click();
    expect(close).toHaveBeenCalledExactlyOnceWith(true);
  });

  it('keeps confirm disabled until the required reason is written and returns it trimmed', async () => {
    const { fixture, close, confirm } = setup({ titleKey: 'confirm.title', messageKey: 'm', reason: { labelKey: 'l', required: true, maxLength: 240 } });
    const textarea: HTMLTextAreaElement = fixture.nativeElement.querySelector('textarea');
    expect(textarea.getAttribute('maxlength')).toBe('240');
    expect(confirm.disabled).toBe(true);
    textarea.value = '   ';
    textarea.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(confirm.disabled).toBe(true);
    textarea.value = ' Sin stock ';
    textarea.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(confirm.disabled).toBe(false);
    confirm.click();
    expect(close).toHaveBeenCalledExactlyOnceWith({ reason: 'Sin stock' });
  });
});
