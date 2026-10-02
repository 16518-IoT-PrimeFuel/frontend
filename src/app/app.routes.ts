import { Routes } from '@angular/router';
import { Home } from './shared/presentation/views/home/home';
import { analyticsGuard, authGuard, adminGuard, buyerGuard, providerGuard, supportedRoleGuard } from './iam/infrastructure/auth.guard';
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

const analyticsRoutes = () =>
  import('./analytics/presentation/analytics-routes').then((m) => m.analyticsRoutes);

const orderingRoutes = () =>
  import('./ordering/presentation/ordering-routes').then((m) => m.orderingRoutes);

const dashboardRoutes = () =>
  import('./dashboard/presentation/dashboard.routes').then((m) => m.dashboardRoutes);

const notificationRoutes = () =>
  import('./notification/presentation/notification-routes').then((m) => m.notificationRoutes);

const equipmentRoutes = () => import('./equipment/presentation/equipment-routes').then((m) => m.equipmentRoutes);

const providerClientRoutes = () => import('./equipment/presentation/provider-routes').then((m) => m.providerClientRoutes);

const adminRoutes = () => import('./admin/presentation/admin-routes').then((m) => m.adminRoutes);

const providerPaymentRoutes = () =>
  import('./ordering/presentation/provider-payments-routes').then((m) => m.providerPaymentRoutes);

const baseTitle = 'FullTank';

export const routes: Routes = [
  { path: 'home', component: Home, title: `Home - ${baseTitle}` },
  { path: 'login', component: Login, title: `Sign in - ${baseTitle}` },
  { path: 'register/buyer', component: Register, data: { role: 'BUYER' }, title: `Buyer registration - ${baseTitle}` },
  { path: 'register/distributor', component: Register, data: { role: 'PROVIDER' }, title: `Distributor registration - ${baseTitle}` },
  { path: 'forgot-password', component: PasswordReset, title: `Password recovery - ${baseTitle}` },
  { path: 'reset-password', component: PasswordReset, title: `Reset password - ${baseTitle}` },
  { path: 'access-denied', component: AccessDenied, title: `Access denied - ${baseTitle}` },
  { path: 'accept-invitation', loadComponent: () => import('./iam/presentation/views/accept-invitation/accept-invitation').then(m => m.AcceptInvitation), title: `Invitation - ${baseTitle}` },
  { path: 'accept-invitation/:token', loadComponent: () => import('./iam/presentation/views/accept-invitation/accept-invitation').then(m => m.AcceptInvitation), title: `Invitation - ${baseTitle}` },
  { path: 'profile', canActivate: [authGuard, supportedRoleGuard], loadComponent: () => import('./shared/presentation/component/layout/layout').then((m) => m.Layout), title: `Profile - ${baseTitle}`, children: [{ path: '', loadComponent: () => import('./iam/presentation/views/profile/profile').then((m) => m.Profile) }] },
  { path: 'about', loadComponent: about, title: `About - ${baseTitle}` },
  { path: 'fuel-products', canActivate: [authGuard, supportedRoleGuard], loadChildren: fuelProductRoutes },
  { path: 'fulfillment', canActivate: [authGuard, providerGuard], loadChildren: fulfillmentRoutes },
  { path: 'dashboard', canActivate: [authGuard, supportedRoleGuard], loadChildren: dashboardRoutes },
  { path: 'ordering', canActivate: [authGuard, supportedRoleGuard], loadChildren: orderingRoutes },
  { path: 'analytics', canActivate: [authGuard, analyticsGuard], loadChildren: analyticsRoutes, title: `Analytics - ${baseTitle}` },
  { path: 'reporting', redirectTo: 'analytics', pathMatch: 'full' },
  { path: 'reporting/report-main', redirectTo: 'analytics', pathMatch: 'full' },
  { path: 'notification', canActivate: [authGuard, supportedRoleGuard], loadChildren: notificationRoutes },
  { path: 'admin', canActivate: [authGuard, adminGuard], loadChildren: adminRoutes, title: `Admin - ${baseTitle}` },
  { path: 'tanks', canActivate: [authGuard, buyerGuard], loadChildren: equipmentRoutes },
  { path: 'payments', canActivate: [authGuard, providerGuard], loadChildren: providerPaymentRoutes },
  { path: 'clients', canActivate: [authGuard, providerGuard], loadChildren: providerClientRoutes },
  { path: '', redirectTo: '/home', pathMatch: 'full' },
  { path: '**', loadComponent: pageNotFound, title: `Page Not Found - ${baseTitle}` },
];
