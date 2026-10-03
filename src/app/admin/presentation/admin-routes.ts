import { Routes } from '@angular/router';
import { Layout } from '../../shared/presentation/component/layout/layout';

const adminPanel = () => import('./views/admin-panel/admin-panel').then(m => m.AdminPanel);

const adminRoutes: Routes = [
  {
    path: '',
    component: Layout,
    children: [{ path: '', loadComponent: adminPanel }],
  },
];

export { adminRoutes };
