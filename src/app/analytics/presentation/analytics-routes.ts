import { Routes } from '@angular/router';
import { Layout } from '../../shared/presentation/component/layout/layout';

const analytics = () =>
  import('./views/analytics/analytics').then((m) => m.Analytics);

const analyticsRoutes: Routes = [
  {
    path: '',
    component: Layout,
    children: [
      { path: '', loadComponent: analytics },
    ],
  },
];

export { analyticsRoutes };
