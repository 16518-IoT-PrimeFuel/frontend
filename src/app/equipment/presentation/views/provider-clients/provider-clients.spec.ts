import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ProviderClients } from './provider-clients';
import { ProviderEquipmentApi } from '../../../infrastructure/provider-equipment.api';

const buyers = [
  { id: 1, name: 'Empresa Andina', ruc: '20261012007', sector: 'Minería', tankCount: 2, criticalTankCount: 1, activeOrderCount: 3, historicalOrderCount: 8, sites: [] },
  { id: 2, name: 'Cliente del Norte', ruc: null, sector: null, tankCount: 1, criticalTankCount: 0, activeOrderCount: 0, historicalOrderCount: 2, sites: [] },
  { id: 3, name: 'Sin tanques', ruc: null, sector: null, tankCount: 0, criticalTankCount: 0, activeOrderCount: 1, historicalOrderCount: 1, sites: [] },
];

async function setup() {
  const read = vi.fn(() => of(buyers));
  TestBed.configureTestingModule({ imports: [ProviderClients, TranslateModule.forRoot()], providers: [provideRouter([]), { provide: ProviderEquipmentApi, useValue: { buyerCompanies: read } }] });
  const fixture = TestBed.createComponent(ProviderClients);
  await fixture.whenStable();
  return { fixture, view: fixture.componentInstance as any, read };
}

it('combines the selected category with name or RUC search and restores all rows', async () => {
  const { view } = await setup();
  expect(view.count('all')).toBe(3);
  expect(view.count('active')).toBe(2);
  expect(view.count('critical')).toBe(1);
  view.filter.set('active');
  view.search.set(' ANDINA ');
  expect(view.rows().map((b: any) => b.id)).toEqual([1]);
  view.search.set('20261012007');
  expect(view.rows().map((b: any) => b.id)).toEqual([1]);
  view.filter.set('critical'); view.search.set('norte');
  expect(view.rows()).toEqual([]);
  view.clearFilters();
  expect(view.rows()).toHaveLength(3);
});

it('renders real statuses, client links and recovery without confusing failures with an empty list', async () => {
  const { fixture, view, read } = await setup();
  const root = fixture.nativeElement;
  expect(root.querySelectorAll('.client-status')[0].textContent).toContain('provider-equipment.clients.critical-status');
  expect(root.querySelectorAll('.client-status')[1].textContent).toContain('equipment.status-ok');
  expect(root.querySelectorAll('.client-status')[2].textContent).toContain('provider-equipment.clients.no-tanks-status');
  expect(root.querySelector('.row-action a').getAttribute('href')).toBe('/clients/1');
  read.mockReturnValue(throwError(() => ({ status: 500 })));
  view.load(); await fixture.whenStable();
  expect(root.querySelector('[role="alert"]').textContent).toContain('provider-equipment.clients.error');
  expect(root.textContent).not.toContain('provider-equipment.clients.empty-hint');
  read.mockReturnValue(of([]));
  root.querySelector('[role="alert"] button').click(); await fixture.whenStable();
  expect(root.querySelector('.client-state button').textContent).toContain('provider-equipment.clients.register');
});

it('opens one registration modal and refreshes the list only after success', async () => {
  const { fixture, view, read } = await setup();
  let closed = new Subject<boolean>();
  const close = vi.fn();
  const open = vi.spyOn(view.dialog, 'open').mockImplementation(() => ({ afterClosed: () => closed, close }));
  view.registerBuyer(); view.registerBuyer();
  expect(open).toHaveBeenCalledOnce();
  expect(open.mock.calls[0][1]).toMatchObject({ ariaLabelledBy: 'buyer-form-title', maxWidth: 'calc(100vw - 32px)' });
  closed.next(false); closed.complete();
  expect(read).toHaveBeenCalledOnce();
  closed = new Subject<boolean>();
  view.registerBuyer(); closed.next(true); closed.complete();
  expect(read).toHaveBeenCalledTimes(2);
  closed = new Subject<boolean>();
  view.registerBuyer(); fixture.destroy();
  expect(close).toHaveBeenCalledOnce();
});
