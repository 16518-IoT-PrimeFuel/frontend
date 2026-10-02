import { beforeEach, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { of, Subject } from 'rxjs';
import { ProviderTankForm } from './provider-tank-form';
import { ProviderEquipmentApi } from '../../../infrastructure/provider-equipment.api';
import { InventoryApi } from '../../../../inventory/infrastructure/inventory-api';
import { IamStore } from '../../../../iam/application/iam.store';

beforeEach(() => TestBed.resetTestingModule());

function setup(editing = false) {
  const api = {
    buyerCompanies: vi.fn(() => of([{ id: 4, name: 'ACME', sites: [{ id: 10, customerAccountId: 7, name: 'Planta' }] }])),
    tanks: vi.fn(() => of([{ id: 23, name: 'Diesel', siteId: 10, fuelProductId: 5, capacity: 1000, unit: 'LITRE', currentLevel: 150, lowLevelPercent: 20, devices: [{ deviceId: 'sensor', channel: 'level' }] }])),
    registerTank: vi.fn((_body: unknown) => new Subject()), updateTank: vi.fn((_id: number, _body: unknown) => new Subject()),
  };
  const inventory = { getProductsByProvider: vi.fn(() => of([{ id: 5, active: true }, { id: 6, active: false }])) };
  TestBed.configureTestingModule({ imports: [ProviderTankForm, TranslateModule.forRoot()], providers: [
    provideRouter([]), { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ buyerId: '4', ...(editing ? { tankId: '23' } : {}) }) } } },
    { provide: ProviderEquipmentApi, useValue: api }, { provide: InventoryApi, useValue: inventory },
    { provide: IamStore, useValue: { providerId: () => 2 } },
  ] });
  const fixture = TestBed.createComponent(ProviderTankForm);
  const view = fixture.componentInstance as any;
  fixture.detectChanges();
  if (!editing) view.form.patchValue({ name: 'Diesel', fuelProductId: 5, capacity: 1000, initialLevel: 150, deviceId: 'sensor' });
  return { fixture, view, api, inventory };
}

it('validates finite numbers and membership before registering, then blocks duplicate submissions', () => {
  const { view, api } = setup();
  view.form.controls.capacity.setValue(null);
  view.submit();
  expect(view.form.controls.capacity.invalid).toBe(true);
  view.form.controls.capacity.setValue(Infinity);
  view.submit();
  view.form.controls.capacity.setValue(1000);
  view.form.controls.siteId.setValue(999);
  view.submit();
  view.form.controls.siteId.setValue(10);
  view.form.controls.fuelProductId.setValue(6);
  view.submit();
  expect(api.registerTank).not.toHaveBeenCalled();
  view.form.controls.fuelProductId.setValue(5);
  view.submit();
  view.submit();
  expect(api.registerTank).toHaveBeenCalledTimes(1);
  expect(api.registerTank.mock.calls[0][0]).toMatchObject({ buyerCompanyId: 4, customerAccountId: 7, siteId: 10 });
});

it('sends only changed editable fields and the complete device pair when editing', () => {
  const { view, api } = setup(true);
  view.form.patchValue({ lowLevelPercent: 25, deviceId: 'sensor-new' });
  view.submit();
  expect(api.updateTank).toHaveBeenCalledWith(23, { lowLevelPercent: 25, deviceId: 'sensor-new', channel: 'level' });
});

it('cancels obsolete loads and pending writes when the view is destroyed', () => {
  const { fixture, view, api } = setup();
  const old = new Subject();
  api.buyerCompanies.mockReturnValueOnce(old as any);
  view.load();
  view.submit();
  expect(api.registerTank).not.toHaveBeenCalled();
  view.load();
  old.next([{ id: 999, sites: [] }]);
  expect(view.buyer().id).toBe(4);
  expect(view.loading()).toBe(false);
  view.submit();
  const pending = api.registerTank.mock.results[0].value;
  fixture.destroy();
  pending.error({ status: 409 });
  expect(view.error()).toBeNull();
});
