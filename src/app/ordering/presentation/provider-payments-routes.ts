import { Routes } from '@angular/router';
import { Layout } from '../../shared/presentation/component/layout/layout';

export const providerPaymentRoutes: Routes = [{
  path: '', component: Layout, children: [
    { path: '', loadComponent: () => import('./views/provider-payments/provider-payments').then((m) => m.ProviderPayments) },
  ],
}];
