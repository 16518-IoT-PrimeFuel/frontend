import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { expect, it } from 'vitest';
import { environment } from '../../../environments/environment';
import { ProviderEquipmentApi } from './provider-equipment.api';

it('sends credential commands only to the selected tank and device channel', () => {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  const api = TestBed.inject(ProviderEquipmentApi);
  const http = TestBed.inject(HttpTestingController);
  const base = `${environment.serverBasePath}/provider/tanks/23/device-credential`;
  api.issueDeviceCredential(23, 'A/B').subscribe();
  api.rotateDeviceCredential(23, 'A/B').subscribe();
  api.revokeDeviceCredential(23, 'A/B').subscribe();
  for (const suffix of ['', '/rotate', '/revoke']) {
    const request = http.expectOne(value => value.url === base + suffix);
    expect(request.request.method).toBe('POST');
    expect(request.request.params.get('channel')).toBe('A/B');
    expect(request.request.body).toBeNull();
    request.flush({ tankId: 23, channel: 'A/B' });
  }
  http.verify();
  TestBed.resetTestingModule();
});
