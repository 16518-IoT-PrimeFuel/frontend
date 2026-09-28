import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { IamApi } from '../../../infrastructure/iam-api';
import { displayAuthError } from '../../../infrastructure/auth-error';

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink, TranslatePipe],
  templateUrl: './password-reset.html',
})
export class PasswordReset {
  private readonly api = inject(IamApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly mode = this.route.snapshot.queryParamMap.has('token') ? 'confirm' : 'request';
  readonly message = signal('');
  readonly error = signal('');
  email = '';
  password = '';

  submit(): void {
    this.error.set('');
    const request = this.mode === 'confirm'
      ? this.api.confirmPasswordReset(this.route.snapshot.queryParamMap.get('token') ?? '', this.password)
      : this.api.requestPasswordReset(this.email);
    request.subscribe({
      next: () => this.message.set(this.mode === 'confirm' ? 'auth.reset.done' : 'auth.reset.sent'),
      error: (error) => this.error.set(displayAuthError(error)),
    });
  }

  goToLogin(): void { void this.router.navigate(['/login']); }
}
