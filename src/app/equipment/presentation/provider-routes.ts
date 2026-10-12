import { Routes } from '@angular/router';
import { Layout } from '../../shared/presentation/component/layout/layout';

export const providerClientRoutes: Routes = [{
  path: '', component: Layout, children: [
    { path: 'new', loadComponent: () => import('./views/provider-buyer-form/provider-buyer-form').then((m) => m.ProviderBuyerForm) },
    { path: 'tank/:id', loadComponent: () => import('./views/provider-tank-detail/provider-tank-detail').then((m) => m.ProviderTankDetail) },
    { path: ':buyerId/tanks/new', loadComponent: () => import('./views/provider-tank-form/provider-tank-form').then((m) => m.ProviderTankForm) },
    { path: ':buyerId/tanks/:tankId/edit', loadComponent: () => import('./views/provider-tank-form/provider-tank-form').then((m) => m.ProviderTankForm) },
    // El detalle es un modal: el listado queda debajo y :buyerId solo marca qué cliente abrir (va al final para no capturar new/tank).
    { path: '', loadComponent: () => import('./views/provider-clients/provider-clients').then((m) => m.ProviderClients), children: [{ path: ':buyerId', children: [] }] },
  ],
}];
