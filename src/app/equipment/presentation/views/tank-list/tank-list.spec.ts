import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EquipmentStore } from '../../../application/equipment.store';
import { RefillPolicy, Tank } from '../../../domain/model/equipment.entity';
import { TankList } from './tank-list';
import { MatDialog } from '@angular/material/dialog';
import { SiteLocationDialog } from './site-location-dialog';
import { of } from 'rxjs';

describe('TankList', () => {
  let fixture: ComponentFixture<TankList>;
  let element: HTMLElement;
  const store = {
    customer: signal({ id: 4, name: 'ACME', legacyCompanyId: 7, active: true }), sites: signal([]), tanks: signal<Tank[]>([]), policies: signal<Record<number, RefillPolicy | null>>({}), episodes: signal([]), readings: signal([]), readingsState: signal('ready'), error: signal(''), loading: signal(false), tanksLoading: signal(false), sitesLoading: signal(false),
    creatingSite: signal(false), creatingTank: signal(false), load: vi.fn(), loadEpisodes: vi.fn(), loadReadings: vi.fn(), createSite: vi.fn(), createTank: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({ imports: [TankList], providers: [provideRouter([]), provideTranslateService()] });
    TestBed.overrideComponent(TankList, { set: { providers: [{ provide: EquipmentStore, useValue: store }] } });
    fixture = TestBed.createComponent(TankList);
    fixture.componentInstance['formOpen'].set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    element = fixture.nativeElement;
  });

  const errors = (form: string) => Array.from(element.querySelectorAll(`${form} mat-error`)).map(error => error.textContent!.trim());

  it('shows the tank errors, focuses the first invalid field and does not call the service on an invalid submit', () => {
    const submit = element.querySelector<HTMLButtonElement>('.tank-form .actions button:not([type="button"])')!;
    expect(submit.disabled).toBe(false);
    expect(errors('.tank-form')).toEqual([]);
    submit.click();
    fixture.detectChanges();
    expect(errors('.tank-form')).toEqual(['validation.required', 'validation.min-value']);
    expect(document.activeElement).toBe(element.querySelector('input[name="tankName"]'));
    expect(store.createTank).not.toHaveBeenCalled();
  });

  it('opens the point selection dialog without creating a site immediately', () => {
    const open = vi.spyOn(fixture.componentInstance['dialog'], 'open').mockReturnValue({ beforeClosed: () => of(undefined), afterClosed: () => of(undefined), close: vi.fn() } as any);
    const submit = element.querySelector<HTMLButtonElement>('.site-form button')!;
    expect(submit.disabled).toBe(false);
    submit.click();
    fixture.detectChanges();
    expect(open).toHaveBeenCalledWith(SiteLocationDialog, expect.objectContaining({ data: { store }, restoreFocus: true }));
    expect(store.createSite).not.toHaveBeenCalled();
    open.mockRestore();
  });

  it('disables the submit buttons only while a request is in flight', () => {
    store.creatingTank.set(true); store.creatingSite.set(true);
    fixture.detectChanges();
    expect(element.querySelector<HTMLButtonElement>('.tank-form .actions button:not([type="button"])')!.disabled).toBe(true);
    expect(element.querySelector<HTMLButtonElement>('.site-form button')!.disabled).toBe(true);
    store.creatingTank.set(false); store.creatingSite.set(false);
  });

  describe('selection', () => {
    const tank = (id: number, currentLevel: number): Tank => ({ id, customerAccountId: 4, siteId: null, name: `T${id}`, capacity: 100, currentLevel, levelSource: 'MANUAL', active: true });
    const show = async (url: string) => {
      store.tanks.set([tank(1, 80), tank(2, 10)]);
      store.policies.set({ 2: { lowLevelPercent: 20, hysteresisPercent: 10, targetLevelPercent: 100, providerId: null, fuelProductId: null, autoGenerateEnabled: false } });
      await TestBed.inject(Router).navigateByUrl(url);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    };

    it('announces the tank chosen in the URL, flags it as low per its policy and links the request to it', async () => {
      await show('/?tank=2');
      expect(element.querySelector('.tk-card[aria-current="true"] strong')!.textContent).toBe('T2');
      expect(element.querySelector('.tk-detail h2')!.textContent).toBe('T2');
      expect(element.querySelector('.tk-detail .tk-status.low')!.textContent).toContain('equipment.status-low');
      expect(element.querySelector('.tk-card:not([aria-current]) .dl-badge')).toBeNull();
      expect(element.querySelector('.tk-load .pct')!.textContent).toBe('10%');
      expect(element.querySelector('.tk-detail a[href*="request-form"]')!.getAttribute('href')).toContain('tankId=2');
      expect(store.loadEpisodes).toHaveBeenLastCalledWith(2);
      expect(store.loadReadings).toHaveBeenLastCalledWith(2);
      element.querySelectorAll<HTMLButtonElement>('.dl-chip')[2].click();
      fixture.detectChanges();
      expect(element.querySelectorAll('.tk-card').length).toBe(0);
      fixture.componentInstance['filter'].set('all');
      store.tanks.set([]); store.policies.set({});
    });

    it('explains a tank that is not in the list instead of choosing another one', async () => {
      await show('/?tank=99');
      expect(element.querySelector('.tk-card[aria-current]')).toBeNull();
      expect(element.querySelector('.tk-detail')!.textContent).toContain('equipment.not-found');
      expect(element.querySelector('.tk-detail a[href*="request-form"]')).toBeNull();
      store.tanks.set([]); store.policies.set({});
    });
  });
});
