import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { IamStore } from '../../../application/iam.store';
import { displayAuthError } from '../../../infrastructure/auth-error';

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink, TranslatePipe],
  templateUrl: './login.html',
})
export class Login {
  private readonly iam = inject(IamStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  readonly error = signal('');
  readonly sending = signal(false);
  readonly showPassword = signal(false);
  readonly returnUrl = this.cleanInvitationReturnUrl();
  readonly sessionRequired = signal(!!this.route.snapshot.queryParamMap.get('returnUrl'));
  username = '';
  password = '';

  private cleanInvitationReturnUrl(): string | null {
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    const legacyToken = returnUrl?.match(/^\/accept-invitation\/([^?#]+)$/)?.[1];
    const fragment = this.route.snapshot.fragment;
    if (fragment || legacyToken) {
      try { this.iam.pendingInvitationToken.set(decodeURIComponent(fragment || legacyToken!)); }
      catch { this.iam.pendingInvitationToken.set(''); }
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { returnUrl: legacyToken ? '/accept-invitation' : returnUrl },
        fragment: undefined, replaceUrl: true,
      });
    }
    return legacyToken ? '/accept-invitation' : returnUrl;
  }

  submit(): void {
    if (this.sending()) return;
    this.error.set('');
    this.sending.set(true);
    this.iam.signIn(this.username, this.password).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => void this.router.navigateByUrl(this.returnUrl || (this.iam.role() === 'ADMIN' ? '/admin' : '/dashboard')),
      error: (error) => { this.error.set(displayAuthError(error)); this.sending.set(false); },
    });
  }
}
