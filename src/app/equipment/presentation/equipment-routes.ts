import { Routes } from '@angular/router';
import { Layout } from '../../shared/presentation/component/layout/layout';

export const equipmentRoutes: Routes = [{
  path: '', component: Layout, children: [
    { path: '', loadComponent: () => import('./views/tank-list/tank-list').then((m) => m.TankList) },
    { path: ':id', loadComponent: () => import('./views/tank-detail/tank-detail').then((m) => m.TankDetail) },
  ],
}];
