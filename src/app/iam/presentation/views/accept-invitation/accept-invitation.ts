import { Component, DestroyRef, inject, signal } from '@angular/core';
import { combineLatest, Subject, takeUntil } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import { MatButton } from '@angular/material/button';
import { MatFormField, MatInput, MatLabel } from '@angular/material/input';
import { IamApi, OrganizationInvitation, OrganizationProfile } from '../../../infrastructure/iam-api';
import { IamStore } from '../../../application/iam.store';
import { LanguageSwitcher } from '../../../../shared/presentation/component/language-switcher/language-switcher';

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink, TranslatePipe, MatButton, MatFormField, MatInput, MatLabel, LanguageSwitcher],
  template: `
    <main class="iam-page">
      <section class="iam-card" [attr.aria-label]="'accept-invitation.title' | translate">
        <app-language-switcher />
        <h1>{{ 'accept-invitation.title' | translate }}</h1>
        @if (accepted()) {
          <p class="success" role="status">{{ 'accept-invitation.accepted' | translate }}</p>
          @if (refreshing()) { <p role="status">{{ 'accept-invitation.refreshing' | translate }}</p> }
          @if (refreshError()) {
            <p class="iam-error" role="alert">{{ 'accept-invitation.refresh-error' | translate }}</p>
            <button mat-stroked-button type="button" [disabled]="refreshing()" (click)="refreshOrganizations()">{{ 'accept-invitation.retry-refresh' | translate }}</button>
          }
          @if (organization()) {
            <p>{{ organization()!.name }} · {{ 'invitations.role-' + accepted()!.role.toLowerCase() | translate }}</p>
          }
          <a routerLink="/profile" [queryParams]="{ tab: 'organizations' }">{{ 'accept-invitation.view-organizations' | translate }}</a>
        } @else {
          <p class="iam-subtitle">{{ 'accept-invitation.help' | translate }}</p>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'invitations.token' | translate }}</mat-label>
            <input matInput name="token" type="password" [ngModel]="token()" (ngModelChange)="changeToken($event)" [disabled]="sending()" autocomplete="off" autocapitalize="none" spellcheck="false" required>
          </mat-form-field>
          @if (iam.isAuthenticated()) {
            <p class="iam-note">{{ 'accept-invitation.account' | translate:{ email: iam.session()?.username } }}</p>
            <p class="iam-subtitle">{{ 'accept-invitation.account-warning' | translate }}</p>
            <button mat-flat-button type="button" [disabled]="!token().trim() || sending()" [attr.aria-busy]="sending()" (click)="accept()">{{ (sending() ? 'accept-invitation.accepting' : 'accept-invitation.accept') | translate }}</button>
            <button mat-stroked-button type="button" [disabled]="sending()" (click)="changeAccount()">{{ 'accept-invitation.change-account' | translate }}</button>
          } @else {
            <p class="iam-note">{{ 'accept-invitation.sign-in-required' | translate }}</p>
            <a routerLink="/login" [queryParams]="{ returnUrl: returnUrl }">{{ 'auth.login.link' | translate }}</a>
            <a routerLink="/register/buyer" [queryParams]="{ returnUrl: returnUrl }">{{ 'auth.register.buyer-link' | translate }}</a>
            <a routerLink="/register/distributor" [queryParams]="{ returnUrl: returnUrl }">{{ 'auth.register.provider-link' | translate }}</a>
          }
          @if (error()) {
            <p class="iam-error" role="alert">{{ error() | translate }}</p>
            @if (error() === 'accept-invitation.http-401') { <a routerLink="/login" [queryParams]="{ returnUrl: returnUrl }">{{ 'auth.login.link' | translate }}</a> }
          }
        }
      </section>
    </main>
  `,
  styles: `
    :host { display: block; color: #111827; }
    .iam-card { width: min(100%, 520px); }
    h1 { font-size: 1.5rem; }
    p { line-height: 1.5; overflow-wrap: anywhere; }
    .success { color: #166534; }
    .iam-card .mat-mdc-outlined-button { background: #fff; color: #1e3a8a; border: 1px solid #1e3a8a; }
    @media (max-width: 560px) { .iam-page { padding: 16px; } .iam-card { padding: 20px; } }
  `,
})
export class AcceptInvitation {
  readonly iam = inject(IamStore);
  private readonly api = inject(IamApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly invitationChanged = new Subject<void>();
  readonly token = signal(this.iam.pendingInvitationToken());
  readonly returnUrl = '/accept-invitation';
  readonly sending = signal(false);
  readonly error = signal('');
  readonly accepted = signal<OrganizationInvitation | null>(null);
  readonly refreshing = signal(false);
  readonly refreshError = signal(false);
  readonly organization = signal<OrganizationProfile | null>(null);

  constructor() {
    combineLatest([this.route.paramMap, this.route.fragment]).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(([params, fragment]) => {
      const routeToken = params.get('token');
      if (!routeToken && !fragment) return;
      let token = routeToken ?? '';
      if (fragment) {
        try { token = decodeURIComponent(fragment); } catch { token = ''; }
      }
      this.invitationChanged.next();
      this.sending.set(false);
      this.refreshing.set(false);
      this.accepted.set(null);
      this.organization.set(null);
      this.refreshError.set(false);
      this.error.set('');
      this.token.set(token);
      this.iam.pendingInvitationToken.set(token);
      void this.router.navigateByUrl('/accept-invitation', { replaceUrl: true });
    });

  }

  changeAccount(): void {
    this.iam.logout(this.returnUrl, this.token().trim());
  }

  changeToken(value: string): void {
    if (this.sending()) return;
    this.token.set(value);
    this.iam.pendingInvitationToken.set(value);
    this.error.set('');
  }

  accept(): void {
    if (!this.iam.isAuthenticated() || this.sending() || this.accepted() || !this.token().trim()) return;
    this.error.set('');
    this.sending.set(true);
    this.api.acceptInvitation(this.token().trim()).pipe(takeUntil(this.invitationChanged), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: invitation => {
        this.accepted.set({ ...invitation, token: '' });
        this.token.set('');
        this.iam.pendingInvitationToken.set('');
        this.sending.set(false);
        this.refreshOrganizations();
      },
      error: error => {
        const key = error?.message ?? 'errors.generic';
        this.error.set(['400', '401', '403', '404', '409', '422'].some(status => key === `errors.http-${status}`)
          ? key.replace('errors.', 'accept-invitation.') : key);
        this.sending.set(false);
      },
    });
  }

  refreshOrganizations(): void {
    const accepted = this.accepted();
    if (!accepted || this.refreshing()) return;
    this.refreshing.set(true);
    this.refreshError.set(false);
    this.iam.refreshMemberships().pipe(takeUntil(this.invitationChanged), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: organizations => {
        this.organization.set(organizations.find(value => value.id === accepted.organizationId) ?? null);
        this.refreshing.set(false);
      },
      error: () => { this.refreshError.set(true); this.refreshing.set(false); },
    });
  }
}
