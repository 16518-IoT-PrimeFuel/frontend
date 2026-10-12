import { afterEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { addressLocation, GeocodingFeature, SiteGeocoding } from './site-geocoding';

// Synthetic contract fixtures only; never used as product locations.
const address = (confidence = 'exact', accuracy = 'rooftop'): GeocodingFeature => ({
  geometry: { type: 'Point', coordinates: [1, 2] },
  properties: { feature_type: 'address', coordinates: { accuracy },
    match_code: { confidence, address_number: 'matched', street: 'matched', place: 'matched' } },
});

describe('Temporary site geocoding', () => {
  afterEach(() => { TestBed.resetTestingModule(); vi.unstubAllGlobals(); });
  const create = () => { TestBed.configureTestingModule({ providers: [SiteGeocoding] }); return TestBed.inject(SiteGeocoding); };
  const site = (id: number, address: string) => ({ id, customerAccountId: 1, name: 'Unit test', address, active: true });

  it('groups identical displayed addresses, skips missing ones and requests temporary results in Peru', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ features: [address()] }) });
    vi.stubGlobal('fetch', fetch);
    const service = create(), sites = [site(1, 'Test address'), site(2, 'Test address'), site(3, '')];
    await service.locate(sites);
    expect(fetch).toHaveBeenCalledTimes(1);
    const query = new URL(fetch.mock.calls[0][0]).searchParams;
    expect([query.get('country'), query.get('permanent'), query.get('autocomplete')]).toEqual(['pe', 'false', 'false']);
    expect(service.locations()[1]).toEqual(service.locations()[2]);
    expect(service.locations()[3]).toEqual({ state: 'unavailable' });
    await service.locate(sites);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('stops a rate-limited batch and exposes independent errors', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: false, status: 429 });
    vi.stubGlobal('fetch', fetch);
    const service = create();
    await service.locate([site(1, 'Address one'), site(2, 'Address two')]);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(Object.values(service.locations()).every(location => location.state === 'error')).toBe(true);
  });

  it('uses persisted manual coordinates without geocoding the address', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    const service = create();
    await service.locate([{ ...site(1, 'Unclear address'), latitude: -12, longitude: -77 }]);
    expect(fetch).not.toHaveBeenCalled();
    expect(service.locations()[1]).toEqual({ state: 'available', coordinates: [-77, -12], source: 'manual' });
  });

  it('city exploration does not assign a location to any tank site', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ features: [{
      geometry: { type: 'Point', coordinates: [1, 2] }, properties: { feature_type: 'place', name: 'Lima' },
    }] }) });
    vi.stubGlobal('fetch', fetch);
    const service = create();
    await service.exploreCity('Lima');
    expect(service.cityCenter()).toEqual([1, 2]);
    expect(service.locations()).toEqual({});
    expect(new URL(fetch.mock.calls[0][0]).searchParams.get('types')).toBe('place');
  });
});

describe('Mapbox v6 address confidence', () => {
  it('accepts a single matched address and marks interpolated or partial matches approximate', () => {
    expect(addressLocation([address()]).state).toBe('available');
    expect(addressLocation([address('high', 'interpolated')]).state).toBe('approximate');
    expect(addressLocation([address('medium')]).state).toBe('approximate');
    const partial = address(); partial.properties!.match_code!['address_number'] = 'inferred';
    expect(addressLocation([partial]).state).toBe('approximate');
  });
  it('does not assign a location to ambiguous or weak matches', () => {
    expect(addressLocation([address(), address('high')])).toEqual({ state: 'unavailable' });
    expect(addressLocation([address('low')])).toEqual({ state: 'unavailable' });
    expect(addressLocation([])).toEqual({ state: 'unavailable' });
  });
  it('rejects cities and malformed/out-of-range coordinates', () => {
    const city = address(); city.properties!.feature_type = 'place';
    expect(addressLocation([city])).toEqual({ state: 'unavailable' });
    const malformed = address(); malformed.geometry!.coordinates = [181, 0];
    expect(addressLocation([malformed])).toEqual({ state: 'unavailable' });
    malformed.geometry!.coordinates = [NaN, 0];
    expect(addressLocation([malformed])).toEqual({ state: 'unavailable' });
  });
});
