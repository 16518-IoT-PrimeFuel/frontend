import { computed, inject, Injectable, signal } from '@angular/core';
import { Observable, switchMap, tap } from 'rxjs';
import { IamApi } from '../infrastructure/iam-api';
import { Session, SignUpForm, sessionRole } from '../domain/model/session.entity';

const STORAGE_KEY = 'fulltank.session';

function restoreSession(): Session | null {
  try {
    const session = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Session | null;
    return session?.token && Array.isArray(session.roles) ? session : null;
  } catch {
    return null;
  }
}

@Injectable({ providedIn: 'root' })
export class IamStore {
  private readonly api = inject(IamApi);
  private readonly current = signal<Session | null>(restoreSession());

  readonly session = this.current.asReadonly();
  readonly role = computed(() => sessionRole(this.current()));
  readonly isAuthenticated = computed(() => !!this.current()?.token);
  readonly isBuyer = computed(() => this.role() === 'BUYER');
  readonly isProvider = computed(() => this.role() === 'PROVIDER');
  readonly userId = computed(() => this.current()?.id ?? null);
  readonly companyId = computed(() => this.current()?.companyId ?? null);
  readonly providerId = computed(() => this.current()?.providerId ?? null);

  signIn(username: string, password: string): Observable<Session> {
    return this.api.signIn(username, password).pipe(tap((session) => this.save(session)));
  }

  signUp(form: SignUpForm): Observable<Session> {
    return this.api.signUp(form).pipe(switchMap(() => this.signIn(form.username, form.password)));
  }

  /** Recarga completa hacia /login: descarta el estado en memoria de todos los stores `root` del usuario anterior. */
  logout(): void {
    this.current.set(null);
    localStorage.removeItem(STORAGE_KEY);
    location.assign('/login');
  }

  private save(session: Session): void {
    this.current.set(session);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }
}
