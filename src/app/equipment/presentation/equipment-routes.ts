import { inject } from '@angular/core';
import { Router, Routes } from '@angular/router';
import { Layout } from '../../shared/presentation/component/layout/layout';

export const equipmentRoutes: Routes = [{
  path: '', component: Layout, children: [
    { path: '', loadComponent: () => import('./views/tank-list/tank-list').then((m) => m.TankList) },
    // La política vive ahora en un diálogo de la lista; los enlaces antiguos abren el tanque seleccionado.
    { path: ':id', redirectTo: ({ params }) => inject(Router).createUrlTree(['/tanks'], { queryParams: { tank: params['id'] } }) },
  ],
}];
