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

/** Analytics: comprador, proveedor o administrador (el admin solo ve el resumen de plataforma). */
export const analyticsGuard: CanActivateFn = () => {
  const iam = inject(IamStore);
  const router = inject(Router);
  return iam.isBuyer() || iam.isProvider() || iam.isAdmin() ? true : router.parseUrl('/access-denied');
};

export const supportedRoleGuard: CanActivateFn = () => {
  const iam = inject(IamStore);
  const router = inject(Router);
  return iam.role() === 'BUYER' || iam.role() === 'PROVIDER' ? true : router.parseUrl('/access-denied');
};
