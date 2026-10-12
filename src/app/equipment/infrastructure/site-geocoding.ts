import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { Site } from '../domain/model/equipment.entity';

export type SiteLocation = {
  state: 'loading' | 'available' | 'approximate' | 'unavailable' | 'error';
  coordinates?: [number, number];
  source?: 'manual';
};
export interface GeocodingFeature {
  geometry?: { type: string; coordinates: number[] };
  properties?: {
    feature_type?: string;
    coordinates?: { accuracy?: string };
    match_code?: Record<string, string>;
  };
}

/** Reject administrative centroids, uncertain matches and competing plausible addresses. */
export function addressLocation(features: GeocodingFeature[]): SiteLocation {
  const eligible = features.filter(feature => {
    const p = feature.properties, c = feature.geometry?.coordinates;
    return p?.feature_type === 'address' && ['exact', 'high', 'medium'].includes(p.match_code?.['confidence'] ?? '')
      && feature.geometry?.type === 'Point' && Array.isArray(c) && c.length === 2
      && c.every(Number.isFinite) && Math.abs(c[0]) <= 180 && Math.abs(c[1]) <= 90;
  });
  if (eligible.length !== 1) return { state: 'unavailable' };
  const feature = eligible[0], p = feature.properties!, match = p.match_code!;
  // A precise coordinate does not turn an inferred/partial address into a precise match.
  const precise = ['exact', 'high'].includes(match['confidence'])
    && match['address_number'] === 'matched' && match['street'] === 'matched'
    && !Object.values(match).includes('unmatched')
    && ['rooftop', 'parcel', 'point'].includes(p.coordinates?.accuracy ?? '');
  return { state: precise ? 'available' : 'approximate', coordinates: feature.geometry!.coordinates as [number, number] };
}

/** Scoped to the /tanks surface: temporary results live only with the displayed session. */
@Injectable()
export class SiteGeocoding {
  readonly locations = signal<Record<number, SiteLocation>>({});
  readonly cityCenter = signal<[number, number] | null>(null);
  readonly cityLoading = signal(false);
  readonly cityError = signal(false);
  private cityController?: AbortController;
  private controller?: AbortController;
  private sequence = 0;
  private displayed = new Map<string, SiteLocation>();

  constructor() {
    inject(DestroyRef).onDestroy(() => { this.controller?.abort(); this.cityController?.abort(); this.displayed.clear(); });
  }

  async locate(sites: Site[]): Promise<void> {
    const sequence = ++this.sequence;
    this.controller?.abort();
    const controller = this.controller = new AbortController();
    const groups = new Map<string, number[]>();
    const result: Record<number, SiteLocation> = {};
    for (const site of sites) {
      if (site.latitude != null && site.longitude != null && Number.isFinite(site.latitude) && Number.isFinite(site.longitude)
          && Math.abs(site.latitude) <= 90 && Math.abs(site.longitude) <= 180) {
        result[site.id] = { state: 'available', coordinates: [site.longitude, site.latitude], source: 'manual' }; continue;
      }
      const address = site.address?.trim().replace(/\s+/g, ' ') ?? '';
      if (!address || address.length > 256 || address.includes(';') || address.split(/\s+/).length > 20) {
        result[site.id] = { state: 'unavailable' }; continue;
      }
      groups.set(address, [...(groups.get(address) ?? []), site.id]);
      result[site.id] = this.displayed.get(address) ?? { state: 'loading' };
    }
    // Keep only results still being displayed; no localStorage, sessionStorage or durable cache.
    this.displayed = new Map([...this.displayed].filter(([address]) => groups.has(address)));
    this.locations.set(result);
    // ponytail: serialize requests to avoid bursts; group identical addresses before calling Mapbox.
    for (const [address, ids] of groups) {
      if (this.displayed.has(address)) continue;
      let location: SiteLocation;
      try {
        const query = new URLSearchParams({ q: address, access_token: environment.mapbox.accessToken,
          autocomplete: 'false', permanent: 'false', types: 'address', country: 'pe', limit: '5', language: 'es' });
        // Native fetch avoids sending FullTank auth headers or logging token-bearing error URLs.
        const response = await fetch(`https://api.mapbox.com/search/geocode/v6/forward?${query}`, {
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]), cache: 'no-store', credentials: 'omit',
        });
        if (!response.ok) {
          location = { state: 'error' };
          // Stop this batch on rate/account failures instead of retrying every remaining address.
          if ([401, 403, 429].includes(response.status)) {
            for (const [id, entry] of Object.entries(result)) if (entry.state === 'loading') result[Number(id)] = location;
            if (sequence === this.sequence) this.locations.set({ ...result });
            return;
          }
        } else {
          const body = await response.json() as { features?: GeocodingFeature[] };
          location = addressLocation(Array.isArray(body.features) ? body.features : []);
        }
      } catch {
        if (controller.signal.aborted) return;
        location = { state: 'error' };
      }
      if (sequence !== this.sequence) return;
      this.displayed.set(address, location);
      ids.forEach(id => result[id] = location);
      this.locations.set({ ...result });
    }
  }

  retry(sites: Site[]): void {
    for (const [address, location] of this.displayed) if (location.state === 'error') this.displayed.delete(address);
    void this.locate(sites);
  }

  /** Navigation only: a city's center never becomes the location of a site or tank. */
  async exploreCity(name: string): Promise<void> {
    this.cityController?.abort();
    const controller = this.cityController = new AbortController();
    this.cityLoading.set(true); this.cityError.set(false);
    try {
      const query = new URLSearchParams({ q: name, country: 'pe', types: 'place', autocomplete: 'false',
        permanent: 'false', limit: '5', language: 'es', access_token: environment.mapbox.accessToken });
      const response = await fetch(`https://api.mapbox.com/search/geocode/v6/forward?${query}`, {
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]), cache: 'no-store', credentials: 'omit',
      });
      if (!response.ok) throw new Error('City lookup unavailable');
      const body = await response.json() as { features?: (GeocodingFeature & { properties: { name?: string; feature_type?: string } })[] };
      const matches = (body.features ?? []).filter(feature => feature.properties?.feature_type === 'place'
        && feature.properties.name?.toLocaleLowerCase() === name.toLocaleLowerCase()
        && feature.geometry?.type === 'Point' && Array.isArray(feature.geometry.coordinates)
        && feature.geometry.coordinates.length === 2 && feature.geometry.coordinates.every(Number.isFinite));
      if (matches.length !== 1) throw new Error('City lookup ambiguous');
      if (!controller.signal.aborted) this.cityCenter.set(matches[0].geometry!.coordinates as [number, number]);
    } catch { if (!controller.signal.aborted) this.cityError.set(true); }
    finally { if (!controller.signal.aborted) this.cityLoading.set(false); }
  }
}
