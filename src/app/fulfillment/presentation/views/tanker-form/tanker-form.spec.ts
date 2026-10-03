import { TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { TankerForm } from './tanker-form';
import { FulfillmentApi } from '../../../infrastructure/fulfillment-api';
import { Tanker } from '../../../domain/model/tanker.entity';

const valid = { licensePlate: ' A ', brand: ' B ', model: ' C ', capacity: 0.5, unit: ' GALLONS ', status: 'MAINTENANCE' };
const tanker = new Tanker({ id: 7, providerId: 3, active: false, licensePlate: 'ABC-123', brand: 'Volvo', model: 'FH16', capacity: 10000, unit: 'LITERS', status: 'SUSPENDED', createdAt: '' });

async function setup(id?: string) {
  TestBed.resetTestingModule();
  const save = new Subject<Tanker>();
  const load = new Subject<Tanker>();
  const api = { registerTanker: vi.fn(() => save), updateTanker: vi.fn(() => save), getTankerById: vi.fn(() => load) };
  TestBed.configureTestingModule({ imports: [TankerForm], providers: [
    provideRouter([]), provideTranslateService(),
    { provide: FulfillmentApi, useValue: api },
    { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap(id === undefined ? {} : { id }) } } },
  ] });
  const fixture = TestBed.createComponent(TankerForm);
  const component = fixture.componentInstance as any;
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  await fixture.whenStable();
  return { fixture, component, api, save, load, navigate };
}

describe('Tanker form contract', () => {
  it('sends all six supported fields, including selected creation status, and blocks duplicate submissions', async () => {
    const { component, fixture, api, save, navigate } = await setup();
    component.tankerForm.setValue(valid);
    component.onSubmit(); component.onSubmit();
    expect(api.registerTanker).toHaveBeenCalledExactlyOnceWith({ ...valid, licensePlate: 'A', brand: 'B', model: 'C', unit: 'GALLONS' });
    expect(component.tankerForm.disabled).toBe(true);
    save.next(tanker); save.complete();
    await fixture.whenStable();
    expect(navigate).toHaveBeenCalledWith(['/fulfillment/tanker-list']);
    expect(component.saving()).toBe(false);
  });

  it('rejects blanks, zero/negative/nonfinite capacity, overlong strings and invalid status', async () => {
    const { component, api } = await setup();
    for (const changes of [{ licensePlate: '   ' }, { brand: ' ' }, { model: ' ' }, { capacity: 0 }, { capacity: -1 }, { capacity: Infinity }, { licensePlate: 'A'.repeat(21) }, { brand: 'A'.repeat(81) }, { model: 'A'.repeat(81) }, { unit: 'A'.repeat(21) }, { status: 'UNKNOWN' }]) {
      component.tankerForm.setValue({ ...valid, ...changes });
      component.onSubmit();
      expect(component.tankerForm.invalid).toBe(true);
    }
    expect(api.registerTanker).not.toHaveBeenCalled();
  });

  it('loads edit data before enabling submission and sends the selected operational state', async () => {
    const { component, fixture, api, load } = await setup('7');
    component.tankerForm.setValue(valid); component.onSubmit();
    expect(api.updateTanker).not.toHaveBeenCalled();
    load.next(tanker); load.complete(); await fixture.whenStable();
    expect(component.tankerForm.value.status).toBe('SUSPENDED');
    expect(fixture.nativeElement.textContent).toContain('tanker-form.inactive-record');
    component.tankerForm.patchValue({ capacity: 12.5, status: 'IN_ROUTE' }); component.onSubmit();
    expect(api.updateTanker).toHaveBeenCalledExactlyOnceWith(7, { licensePlate: 'ABC-123', brand: 'Volvo', model: 'FH16', capacity: 12.5, unit: 'LITERS', status: 'IN_ROUTE' });
  });

  it('preserves data after a save failure so the user can retry', async () => {
    const { component, fixture, save } = await setup();
    component.tankerForm.setValue(valid); component.onSubmit();
    save.error(new Error('errors.http-409')); await fixture.whenStable();
    expect(component.error()).toBe('errors.http-409');
    expect(component.saving()).toBe(false);
    expect(component.tankerForm.enabled).toBe(true);
    expect(component.tankerForm.value.licensePlate).toBe('A');
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('errors.http-409');
  });

  it('does not save after load errors and rejects malformed edit identifiers', async () => {
    let result = await setup('7');
    result.load.error(new Error('errors.http-404')); await result.fixture.whenStable();
    result.component.tankerForm.setValue(valid); result.component.onSubmit();
    expect(result.api.updateTanker).not.toHaveBeenCalled();
    expect(result.fixture.nativeElement.querySelector('form')).toBeNull();
    result = await setup('invalid');
    expect(result.api.getTankerById).not.toHaveBeenCalled();
    result.component.onSubmit();
    expect(result.api.registerTanker).not.toHaveBeenCalled();
    expect(result.component.error()).toBe('tanker-form.invalid-id');
  });
});
