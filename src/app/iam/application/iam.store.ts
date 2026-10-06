import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { Observable, catchError, filter, switchMap, tap, throwError } from 'rxjs';
import { NavigationStart, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { IamApi, OrganizationProfile } from '../infrastructure/iam-api';
import { Session, SignUpForm, sessionRole } from '../domain/model/session.entity';

const STORAGE_KEY = 'fulltank.session';
const ORGANIZATION_KEY = 'fulltank.organization';

function restoreSession(): Session | null {
  try {
    const session = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Session | null;
    return session?.token && Array.isArray(session.roles) ? session : null;
  } catch {
    return null;
  }
}

/** La cuenta se creó, pero falló el ingreso encadenado: no es un error de registro. */
export class SignInAfterSignUpError extends Error {}

@Injectable({ providedIn: 'root' })
export class IamStore {
  private readonly api = inject(IamApi);
  private readonly current = signal<Session | null>(restoreSession());

  // Solo memoria: nunca persistir el token de una invitación en la sesión.
  readonly pendingInvitationToken = signal('');
  private readonly selectedOrganization = signal<number | null>(this.restoreOrganization());
  readonly organizationId = this.selectedOrganization.asReadonly();
  readonly session = this.current.asReadonly();
  readonly role = computed(() => sessionRole(this.current()));
  readonly isAuthenticated = computed(() => !!this.current()?.token);
  readonly isBuyer = computed(() => this.role() === 'BUYER');
  readonly isProvider = computed(() => this.role() === 'PROVIDER');
  readonly isAdmin = computed(() => !!this.current()?.roles.includes('ROLE_ADMIN'));
  readonly userId = computed(() => this.current()?.id ?? null);
  readonly companyId = computed(() => this.current()?.companyId ?? null);
  readonly providerId = computed(() => this.current()?.providerId ?? null);

  constructor() {
    inject(Router).events.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe(event => {
      if (event instanceof NavigationStart && !/^\/(accept-invitation(?:[\/#?]|$)|login(?:[?#]|$)|register(?:\/|$))/.test(event.url)) this.pendingInvitationToken.set('');
    });
  }

  signIn(username: string, password: string): Observable<Session> {
    return this.api.signIn(username, password).pipe(tap((session) => this.save(session)));
  }

  signUp(form: SignUpForm): Observable<Session> {
    return this.api.signUp(form).pipe(switchMap(() => this.signIn(form.username, form.password).pipe(
      catchError(() => throwError(() => new SignInAfterSignUpError())),
    )));
  }

  refreshMemberships(): Observable<OrganizationProfile[]> {
    const requestedSession = this.current();
    return this.api.getOrganizations().pipe(
      filter(() => !!requestedSession && this.current()?.token === requestedSession.token && this.current()?.id === requestedSession.id),
      tap(organizations => {
        const session = this.current();
        if (!session) return;
        // Conservar el orden previo: esta historia no cambia la organización activa.
        const previousIds = session.memberships?.map(value => value.organizationId) ?? [];
        const memberships = organizations.map(value => ({ organizationId: value.id, role: value.role }));
        memberships.sort((a, b) => {
          const aIndex = previousIds.indexOf(a.organizationId);
          const bIndex = previousIds.indexOf(b.organizationId);
          return (aIndex < 0 ? previousIds.length : aIndex) - (bIndex < 0 ? previousIds.length : bIndex);
        });
        this.save({ ...session, memberships });
      }),
    );
  }

  /** Recarga completa hacia /login: descarta el estado en memoria de todos los stores `root` del usuario anterior. */
  logout(returnUrl?: string, invitationToken?: string): void {
    this.pendingInvitationToken.set('');
    this.current.set(null);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* Sesión en memoria ya descartada. */ }
    this.selectedOrganization.set(null);
    try { localStorage.removeItem(ORGANIZATION_KEY); } catch { /* Contexto solo en memoria si storage no está disponible. */ }
    const target = returnUrl ? `/login?returnUrl=${encodeURIComponent(returnUrl)}` : '/login';
    location.replace(invitationToken ? `${target}#${encodeURIComponent(invitationToken)}` : target);
  }

  selectOrganization(organizationId: number | null): boolean {
    const session = this.current();
    if (!session || (organizationId !== null && !session.memberships?.some(value => value.organizationId === organizationId))) return false;
    this.selectedOrganization.set(organizationId);
    if (organizationId === null) try { localStorage.removeItem(ORGANIZATION_KEY); } catch { /* Contexto solo en memoria si storage no está disponible. */ }
    else { try { localStorage.setItem(ORGANIZATION_KEY, JSON.stringify({ userId: session.id, organizationId })); } catch { /* Contexto solo en memoria. */ } }
    return true;
  }

  private restoreOrganization(): number | null {
    const session = this.current();
    try {
      const saved = JSON.parse(localStorage.getItem(ORGANIZATION_KEY) ?? 'null');
      if (saved?.userId === session?.id && session?.memberships?.some(value => value.organizationId === saved.organizationId)) return saved.organizationId;
    } catch { /* Descartar un contexto local inválido. */ }
    try { localStorage.removeItem(ORGANIZATION_KEY); } catch { /* Contexto solo en memoria si storage no está disponible. */ }
    return session?.memberships?.[0]?.organizationId ?? null;
  }

  private save(session: Session): void {
    const previousUserId = this.current()?.id;
    this.current.set(session);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(session)); } catch { /* Sesión solo en memoria. */ }
    const selected = previousUserId === session.id ? this.selectedOrganization() : null;
    this.selectOrganization(session.memberships?.some(value => value.organizationId === selected) ? selected : session.memberships?.[0]?.organizationId ?? null);
  }
}
