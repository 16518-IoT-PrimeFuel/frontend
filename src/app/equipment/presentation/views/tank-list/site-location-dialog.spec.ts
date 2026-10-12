import { ElementRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NgForm } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SiteGeocoding } from '../../../infrastructure/site-geocoding';
import { SiteLocationDialog } from './site-location-dialog';

describe('Manual site registration', () => {
  afterEach(() => TestBed.resetTestingModule());
  it('requires a name and a chosen point before forwarding coordinates and type to the store', () => {
    const store = { creatingSite: signal(false), createSite: vi.fn() };
    TestBed.configureTestingModule({ providers: [
      { provide: MAT_DIALOG_DATA, useValue: { store } },
      { provide: MatDialogRef, useValue: { close: vi.fn(), disableClose: false } },
      { provide: ElementRef, useValue: new ElementRef(document.createElement('div')) },
      { provide: SiteGeocoding, useValue: { exploreCity: vi.fn() } },
    ] });
    const dialog = TestBed.runInInjectionContext(() => new SiteLocationDialog());
    const form = { invalid: false, control: { markAllAsTouched: vi.fn() } } as unknown as NgForm;
    dialog['save'](form);
    expect(store.createSite).not.toHaveBeenCalled();
    dialog['name'] = 'Manual test';
    dialog['save'](form);
    expect(store.createSite).not.toHaveBeenCalled();
    dialog['point'].set([-77, -12]);
    dialog['siteType'] = 'STATION';
    dialog['save'](form);
    expect(store.createSite).toHaveBeenCalledWith({ name: 'Manual test', address: '',
      siteType: 'STATION', longitude: -77, latitude: -12 }, expect.any(Function));
  });
});
