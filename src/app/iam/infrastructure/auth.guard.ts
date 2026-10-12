import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { IamStore } from '../application/iam.store';

export const authGuard: CanActivateFn = (_route, state) => {
  const iam = inject(IamStore);
  const router = inject(Router);
  return iam.isAuthenticated() ? true : router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

export const buyerGuard: CanActivateFn = () => {
  const iam = inject(IamStore);
  const router = inject(Router);
  return iam.isBuyer() ? true : router.parseUrl(iam.isAuthenticated() ? '/access-denied' : '/login');
};

export const providerGuard: CanActivateFn = () => {
  const iam = inject(IamStore);
  const router = inject(Router);
  return iam.isProvider() ? true : router.parseUrl(iam.isAuthenticated() ? '/access-denied' : '/login');
};

export const adminGuard: CanActivateFn = () => {
  const iam = inject(IamStore);
  const router = inject(Router);
  return iam.isAdmin() ? true : router.parseUrl(iam.isAuthenticated() ? '/access-denied' : '/login');
};

/** Dashboard: comprador, proveedor o administrador (el admin solo ve el resumen de plataforma). */
export const dashboardGuard: CanActivateFn = () => {
  const iam = inject(IamStore);
  const router = inject(Router);
  return iam.isBuyer() || iam.isProvider() || iam.isAdmin() ? true : router.parseUrl('/access-denied');
};

/** Portada pública: con sesión, el inicio es el dashboard. */
export const guestGuard: CanActivateFn = () => inject(IamStore).isAuthenticated() ? inject(Router).parseUrl('/dashboard') : true;

export const supportedRoleGuard: CanActivateFn = () => {
  const iam = inject(IamStore);
  const router = inject(Router);
  return iam.role() === 'BUYER' || iam.role() === 'PROVIDER' ? true : router.parseUrl('/access-denied');
};
