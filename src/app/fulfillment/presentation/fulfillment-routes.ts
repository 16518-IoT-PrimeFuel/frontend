import { Routes } from '@angular/router';
import { Layout } from '../../shared/presentation/component/layout/layout';

// Lazy loading de las vistas del BC Fulfillment
const tankerList = () =>
  import('./views/tanker-list/tanker-list').then((m) => m.TankerList);

const tankerForm = () =>
  import('./views/tanker-form/tanker-form').then((m) => m.TankerForm);

const driverList = () =>
  import('./views/driver-list/driver-list').then((m) => m.DriverList);

const driverForm = () =>
  import('./views/driver-form/driver-form').then((m) => m.DriverForm);
const deliveryDetail = () => import('./views/delivery-detail/delivery-detail').then(m => m.DeliveryDetail);

const fulfillmentRoutes: Routes = [
  {
    path: '',
    component: Layout,
    children: [
      { path: 'tanker-list', loadComponent: tankerList },
      { path: 'tanker-form', loadComponent: tankerForm },
      { path: 'tanker-form/:id', loadComponent: tankerForm },
      { path: 'vehicle-list', redirectTo: 'tanker-list', pathMatch: 'full' },
      { path: 'vehicle-form', redirectTo: 'tanker-form', pathMatch: 'full' },
      { path: 'vehicle-form/:id', redirectTo: 'tanker-form/:id', pathMatch: 'full' },
      { path: 'driver-list', loadComponent: driverList },
      { path: 'driver-form', loadComponent: driverForm },
      { path: 'driver-form/:id', loadComponent: driverForm },
      { path: 'delivery-list', loadComponent: () => import('./views/delivery-list/delivery-list').then(m => m.DeliveryList) },
      { path: 'delivery-detail/:id', loadComponent: deliveryDetail },
      { path: '', redirectTo: 'tanker-list', pathMatch: 'full' },
    ],
  },
];

export { fulfillmentRoutes };
