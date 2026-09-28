import { Routes } from '@angular/router';
import { Home } from './shared/presentation/views/home/home';
import { authGuard, buyerGuard, providerGuard, supportedRoleGuard } from './iam/infrastructure/auth.guard';
import { Login } from './iam/presentation/views/login/login';
import { Register } from './iam/presentation/views/register/register';
import { PasswordReset } from './iam/presentation/views/password-reset/password-reset';
import { AccessDenied } from './iam/presentation/views/access-denied/access-denied';

const about = () => import('./shared/presentation/views/about/about').then((m) => m.About);

const pageNotFound = () =>
  import('./shared/presentation/views/page-not-found/page-not-found').then((m) => m.PageNotFound);

const fuelProductRoutes = () =>
  import('./inventory/presentation/inventory-routes').then((m) => m.fuelProductRoutes);

const fulfillmentRoutes = () =>
  import('./fulfillment/presentation/fulfillment-routes').then((m) => m.fulfillmentRoutes);

const reportingRoutes = () =>
  import('./reporting/presentation/reporting-routes').then((m) => m.reportingRoutes);

const orderingRoutes = () =>
  import('./ordering/presentation/ordering-routes').then((m) => m.orderingRoutes);

const dashboardRoutes = () =>
  import('./dashboard/presentation/dashboard.routes').then((m) => m.dashboardRoutes);

const notificationRoutes = () =>
  import('./notification/presentation/notification-routes').then((m) => m.notificationRoutes);

const equipmentRoutes = () => import('./equipment/presentation/equipment-routes').then((m) => m.equipmentRoutes);

const baseTitle = 'FullTank';

export const routes: Routes = [
  { path: 'home', component: Home, title: `Home - ${baseTitle}` },
  { path: 'login', component: Login, title: `Sign in - ${baseTitle}` },
  { path: 'register/buyer', component: Register, data: { role: 'BUYER' }, title: `Buyer registration - ${baseTitle}` },
  { path: 'register/distributor', component: Register, data: { role: 'PROVIDER' }, title: `Distributor registration - ${baseTitle}` },
  { path: 'forgot-password', component: PasswordReset, title: `Password recovery - ${baseTitle}` },
  { path: 'reset-password', component: PasswordReset, title: `Reset password - ${baseTitle}` },
  { path: 'access-denied', component: AccessDenied, title: `Access denied - ${baseTitle}` },
  { path: 'profile', canActivate: [authGuard, supportedRoleGuard], loadComponent: () => import('./iam/presentation/views/profile/profile').then((m) => m.Profile), title: `Profile - ${baseTitle}` },
  { path: 'about', loadComponent: about, title: `About - ${baseTitle}` },
  { path: 'fuel-products', canActivate: [authGuard, supportedRoleGuard], loadChildren: fuelProductRoutes },
  { path: 'fulfillment', canActivate: [authGuard, providerGuard], loadChildren: fulfillmentRoutes },
  { path: 'dashboard', canActivate: [authGuard, supportedRoleGuard], loadChildren: dashboardRoutes },
  { path: 'ordering', canActivate: [authGuard, supportedRoleGuard], loadChildren: orderingRoutes },
  { path: 'reporting', canActivate: [authGuard, supportedRoleGuard], loadChildren: reportingRoutes },
  { path: 'notification', canActivate: [authGuard, supportedRoleGuard], loadChildren: notificationRoutes },
  { path: 'tanks', canActivate: [authGuard, buyerGuard], loadChildren: equipmentRoutes },
  { path: '', redirectTo: '/home', pathMatch: 'full' },
  { path: '**', loadComponent: pageNotFound, title: `Page Not Found - ${baseTitle}` },
];
