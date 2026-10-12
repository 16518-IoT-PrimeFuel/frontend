import { afterEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { of, Subject, throwError } from 'rxjs';
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

  function credentialsSetup() {
    const binding = { deviceId: 'device-23', channel: 'A' };
    const issued = { tankId: 23, deviceId: binding.deviceId, channel: 'A', credentialId: 5, tokenVersion: 1, token: 'secret-device-token' };
    const api = {
      tank: vi.fn(() => of({ id: 23, devices: [binding] })), readings: () => of([]), episodes: () => of([]),
      issueDeviceCredential: vi.fn(() => of(issued)), rotateDeviceCredential: vi.fn(() => of(issued)),
      revokeDeviceCredential: vi.fn(() => of({ ...issued, token: undefined, revokedAt: '2026-10-12T12:00:00Z' })),
    };
    TestBed.configureTestingModule({ imports: [TranslateModule.forRoot()], providers: [
      provideRouter([]), { provide: ProviderEquipmentApi, useValue: api },
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: '23' }) } } },
    ] });
    TestBed.overrideComponent(ProviderTankDetail, { set: { template: '' } });
    const fixture = TestBed.createComponent(ProviderTankDetail);
    const view = fixture.componentInstance as any;
    view.loadTank();
    view.toggleCredential({ target: { open: true } });
    return { fixture, view, api, issued };
  }

  it('keeps the issued token only in memory and clears it on closing, channel changes or leaving', () => {
    const { fixture, view, api } = credentialsSetup();
    view.manageCredential('issue');
    expect(api.issueDeviceCredential).toHaveBeenCalledExactlyOnceWith(23, 'A');
    expect(view.deviceToken()).toBe('secret-device-token');
    expect(view.credential()).not.toHaveProperty('token');
    expect(JSON.stringify({ ...localStorage, ...sessionStorage })).not.toContain('secret-device-token');
    view.toggleCredential({ target: { open: false } });
    expect(view.deviceToken()).toBe('');
    view.toggleCredential({ target: { open: true } });
    expect(view.deviceToken()).toBe('');
    view.manageCredential('issue');
    view.changeChannel();
    expect(view.deviceToken()).toBe('');
    view.manageCredential('issue');
    fixture.destroy();
    expect(view.deviceToken()).toBe('');
  });

  it('requires confirmation before rotation or revocation and rejects obsolete channels', () => {
    const { fixture, view, api } = credentialsSetup();
    let closed = new Subject<boolean>();
    const open = vi.spyOn(view.dialog, 'open').mockImplementation(() => ({ afterClosed: () => closed, close: vi.fn() }));
    view.manageCredential('rotate');
    view.manageCredential('revoke');
    expect(open).toHaveBeenCalledOnce();
    expect(api.rotateDeviceCredential).not.toHaveBeenCalled();
    closed.next(false); closed.complete();
    closed = new Subject<boolean>();
    view.manageCredential('rotate');
    closed.next(true); closed.complete();
    expect(api.rotateDeviceCredential).toHaveBeenCalledExactlyOnceWith(23, 'A');
    closed = new Subject<boolean>();
    view.manageCredential('revoke');
    view.channel = 'B';
    closed.next(true); closed.complete();
    expect(api.revokeDeviceCredential).not.toHaveBeenCalled();
    view.channel = 'A';
    closed = new Subject<boolean>();
    view.manageCredential('revoke');
    closed.next(true); closed.complete();
    expect(api.revokeDeviceCredential).toHaveBeenCalledExactlyOnceWith(23, 'A');
    expect(view.deviceToken()).toBe('');
    fixture.destroy();
  });

  it('blocks duplicate requests, does not redisplay a token received after closing and explains conflicts', () => {
    const { fixture, view, api, issued } = credentialsSetup();
    const pending = new Subject<typeof issued>();
    api.issueDeviceCredential.mockReturnValue(pending);
    view.manageCredential('issue'); view.manageCredential('issue');
    expect(api.issueDeviceCredential).toHaveBeenCalledOnce();
    view.toggleCredential({ target: { open: false } });
    pending.next(issued); pending.complete();
    expect(view.deviceToken()).toBe('');
    expect(view.credentialBusy()).toBe(false);
    api.issueDeviceCredential.mockReturnValue(throwError(() => ({ status: 409, error: { code: 'DEVICECREDENTIAL_CONFLICT' } })));
    view.manageCredential('issue');
    expect(view.credentialError()).toBe('device.already-issued');
    expect(view.credentialBusy()).toBe(false);
    fixture.destroy();
  });

  it('clamps the visual level and free capacity, and hides a late token after switching tabs', () => {
    const { fixture, view, api, issued } = credentialsSetup();
    view.tank.set({ data: { capacity: 1000, currentLevel: 250 } });
    expect(view.percent()).toBe(25);
    expect(view.freeSpace()).toBe(750);
    view.tank.set({ data: { capacity: 1000, currentLevel: 1100 } });
    expect(view.percent()).toBe(100);
    expect(view.freeSpace()).toBe(0);
    view.tank.set({ data: { capacity: 0, currentLevel: 0 } });
    expect(view.percent()).toBe(0);
    view.loadTank();
    const pending = new Subject<typeof issued>();
    api.issueDeviceCredential.mockReturnValue(pending);
    view.manageCredential('issue');
    view.changeTab();
    pending.next(issued); pending.complete();
    expect(view.deviceToken()).toBe('');
    expect(view.credentialOpen).toBe(false);
    fixture.destroy();
  });
});
