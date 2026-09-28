import { Routes } from '@angular/router';
import { Layout } from '../../shared/presentation/component/layout/layout';
import { buyerGuard } from '../../iam/infrastructure/auth.guard';

const requestList = () => import('./views/request-list/request-list').then(m => m.RequestList);
const requestForm = () => import('./views/request-form/request-form').then(m => m.RequestForm);
const orderList = () => import('./views/order-list/order-list').then(m => m.OrderList);
const orderDetail = () => import('./views/order-detail/order-detail').then(m => m.OrderDetail);

const orderingRoutes: Routes = [
  {
    path: '',
    component: Layout,
    children: [
      { path: 'request-list',           loadComponent: requestList },
      { path: 'request-form',           canActivate: [buyerGuard], loadComponent: requestForm },
      { path: 'request-form/:id',       canActivate: [buyerGuard], loadComponent: requestForm },
      { path: 'order-list',             loadComponent: orderList },
      { path: 'order-detail/:id',       loadComponent: orderDetail },
      { path: '', redirectTo: 'request-list', pathMatch: 'full' },
    ],
  },
];

export { orderingRoutes };
