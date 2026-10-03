import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { beforeEach, expect, it, vi } from 'vitest';
import { IamStore } from '../../../iam/application/iam.store';
import { OrderingApi } from '../../../ordering/infrastructure/ordering-api';
import { ProviderEquipmentApi } from '../../infrastructure/provider-equipment.api';
import { ProviderClients } from './provider-clients/provider-clients';
import { ProviderClientDetail } from './provider-client-detail/provider-client-detail';
import { ProviderTankDetail } from './provider-tank-detail/provider-tank-detail';

beforeEach(() => TestBed.resetTestingModule());

const views: { component: Type<any>; refresh: (view: any) => void }[] = [
  { component: ProviderClients, refresh: view => view.load() },
  { component: ProviderClientDetail, refresh: view => view.load() },
  { component: ProviderTankDetail, refresh: view => { view.loadTank(); view.loadReadings(); view.loadEpisodes(); } },
];

it.each(views)('$component.name cancels old reads on refresh and all pending reads on exit', ({ component, refresh }) => {
  const old = new Subject<any>();
  const current = new Subject<any>();
  let source = old;
  const read = vi.fn(() => source);
  TestBed.configureTestingModule({ imports: [TranslateModule.forRoot()], providers: [
    provideRouter([]),
    { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ buyerId: '4', id: '23' }) } } },
    { provide: ProviderEquipmentApi, useValue: { buyerCompanies: read, tanks: read, tank: read, readings: read, episodes: read } },
    { provide: OrderingApi, useValue: { orders: read } }, { provide: IamStore, useValue: { providerId: () => 2 } },
  ] });
  TestBed.overrideComponent(component, { set: { template: '' } });
  const fixture = TestBed.createComponent(component);
  refresh(fixture.componentInstance);
  expect(old.observed).toBe(true);
  source = current;
  refresh(fixture.componentInstance);
  expect(old.observed).toBe(false);
  expect(current.observed).toBe(true);
  fixture.destroy();
  expect(current.observed).toBe(false);
});
