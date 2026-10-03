import { Routes } from '@angular/router';
import { Layout } from '../../shared/presentation/component/layout/layout';

export const providerClientRoutes: Routes = [{
  path: '', component: Layout, children: [
    { path: '', loadComponent: () => import('./views/provider-clients/provider-clients').then((m) => m.ProviderClients) },
    { path: 'new', loadComponent: () => import('./views/provider-buyer-form/provider-buyer-form').then((m) => m.ProviderBuyerForm) },
    { path: 'tank/:id', loadComponent: () => import('./views/provider-tank-detail/provider-tank-detail').then((m) => m.ProviderTankDetail) },
    { path: ':buyerId', loadComponent: () => import('./views/provider-client-detail/provider-client-detail').then((m) => m.ProviderClientDetail) },
    { path: ':buyerId/tanks/new', loadComponent: () => import('./views/provider-tank-form/provider-tank-form').then((m) => m.ProviderTankForm) },
    { path: ':buyerId/tanks/:tankId/edit', loadComponent: () => import('./views/provider-tank-form/provider-tank-form').then((m) => m.ProviderTankForm) },
  ],
}];
