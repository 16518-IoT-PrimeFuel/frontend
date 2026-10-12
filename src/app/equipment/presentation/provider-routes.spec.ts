import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, provideRouter, Route, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { expect, it } from 'vitest';
import { providerClientRoutes } from './provider-routes';

@Component({ template: '' })
class Stub {}

// Mismo árbol de rutas real, con los componentes cambiados por un stub.
const stub = (routes: Route[]): Route[] => routes.map((r) => ({
  ...r,
  component: undefined,
  loadComponent: r.loadComponent || r.component ? () => Stub : undefined,
  children: r.children && stub(r.children),
}));

const params = (s: ActivatedRouteSnapshot): Record<string, string> =>
  ({ ...s.params, ...(s.firstChild ? params(s.firstChild) : {}) });

async function visit(url: string) {
  TestBed.configureTestingModule({ providers: [provideRouter([{ path: 'clients', children: stub(providerClientRoutes[0].children!) }])] });
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl(url);
  const router = TestBed.inject(Router);
  return { url: router.url, params: params(router.routerState.snapshot.root) };
}

it('/clients/3 keeps the list route and exposes the buyer for the modal', async () => {
  const r = await visit('/clients/3');
  expect(r.params).toEqual({ buyerId: '3' });
});

it('/clients stays on the list without a buyer', async () => {
  expect((await visit('/clients')).params).toEqual({});
});

it('new, tank detail and tank form remain full pages', async () => {
  TestBed.resetTestingModule();
  expect((await visit('/clients/new')).params).toEqual({});
  TestBed.resetTestingModule();
  expect((await visit('/clients/tank/4')).params).toEqual({ id: '4' });
  TestBed.resetTestingModule();
  expect((await visit('/clients/3/tanks/4/edit')).params).toEqual({ buyerId: '3', tankId: '4' });
});
