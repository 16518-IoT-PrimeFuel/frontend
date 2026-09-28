import { Component, inject, signal } from '@angular/core';
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
  readonly error = signal('');
  username = '';
  password = '';

  submit(): void {
    this.error.set('');
    this.iam.signIn(this.username, this.password).subscribe({
      next: () => void this.router.navigateByUrl(this.route.snapshot.queryParamMap.get('returnUrl') || (this.iam.role() === 'ADMIN' ? '/admin' : '/dashboard')),
      error: (error) => this.error.set(displayAuthError(error)),
    });
  }
}
