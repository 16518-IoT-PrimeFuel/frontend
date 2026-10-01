import { Routes } from '@angular/router';
import { Layout } from '../../shared/presentation/component/layout/layout';

const dashboard = () =>
  import('../../dashboard/presentation/views/dashboard/dashboard').then((m) => m.Dashboard);

const analyticsRoutes: Routes = [
  {
    path: '',
    component: Layout,
    children: [
      { path: 'report-main', loadComponent: dashboard },
      { path: '', redirectTo: 'report-main', pathMatch: 'full' },
    ],
  },
];

export { analyticsRoutes };
