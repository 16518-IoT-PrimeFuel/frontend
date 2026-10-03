import { afterEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';
import { ProviderTankDetail } from './provider-tank-detail';
import { ProviderEquipmentApi } from '../../../infrastructure/provider-equipment.api';

describe('ProviderTankDetail reading age', () => {
  afterEach(() => { TestBed.resetTestingModule(); vi.useRealTimers(); });

  it('marks a reading as stale as time passes without another API response', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-02T12:00:00Z'));
    TestBed.configureTestingModule({ imports: [TranslateModule.forRoot()], providers: [
      provideRouter([]),
      { provide: ProviderEquipmentApi, useValue: { tank: () => of(null), readings: () => of([{ capturedAt: '2026-10-02T11:00:00Z' }]), episodes: () => of([]) } },
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: '23' }) } } },
    ] });
    TestBed.overrideComponent(ProviderTankDetail, { set: { template: '' } });
    const fixture = TestBed.createComponent(ProviderTankDetail);
    const view = fixture.componentInstance as any;
    view.readings.set({ loading: false, error: false, data: [{ capturedAt: '2026-10-02T11:00:00Z' }] });
    expect(view.ageMinutes()).toBe(60);
    expect(view.stale()).toBe(false);
    vi.advanceTimersByTime(60_000);
    expect(view.ageMinutes()).toBe(61);
    expect(view.stale()).toBe(true);
    fixture.destroy();
    expect(vi.getTimerCount()).toBe(0);
  });
});
