import { Routes } from '@angular/router';
import {Layout} from '../../shared/presentation/component/layout/layout';
import { providerGuard } from '../../iam/infrastructure/auth.guard';

// Lazy loading de las vistas del BC Catalog
const productInventory = () =>
  import('./views/product-inventory/product-inventory').then((m) => m.ProductInventory);

const productForm = () =>
  import('./views/product-form/product-form').then((m) => m.ProductForm);

const fuelProductRoutes: Routes = [
  {
    path: '',
    component: Layout,
    children: [
      { path: '', loadComponent: productInventory },
      { path: 'product-form', canActivate: [providerGuard], loadComponent: productForm },
      { path: 'product-form/:id', canActivate: [providerGuard], loadComponent: productForm },
    ],
  },
];

export { fuelProductRoutes };
