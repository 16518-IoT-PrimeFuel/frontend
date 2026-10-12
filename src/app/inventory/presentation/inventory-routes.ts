import { Routes } from '@angular/router';
import {Layout} from '../../shared/presentation/component/layout/layout';

// Lazy loading de las vistas del BC Catalog
const productInventory = () =>
  import('./views/product-inventory/product-inventory').then((m) => m.ProductInventory);

const fuelProductRoutes: Routes = [
  {
    path: '',
    component: Layout,
    children: [
      { path: '', loadComponent: productInventory },
    ],
  },
];

export { fuelProductRoutes };
