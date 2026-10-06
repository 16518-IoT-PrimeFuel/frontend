import { TestBed } from '@angular/core/testing';
import { NgForm } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { signal } from '@angular/core';
import { Subject, of, throwError } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IamStore, SignInAfterSignUpError } from '../../application/iam.store';
import { IamApi } from '../../infrastructure/iam-api';
import { Login } from './login/login';
import { Register } from './register/register';

async function setup(component: typeof Login | typeof Register) {
  const response = new Subject<any>();
  const iam = { signIn: vi.fn(() => response), signUp: vi.fn(() => response), pendingInvitationToken: signal(''), role: () => 'BUYER' };
  TestBed.configureTestingModule({
    imports: [component],
    providers: [
      provideRouter([]), provideTranslateService(),
      { provide: IamStore, useValue: iam },
      { provide: ActivatedRoute, useValue: { snapshot: { data: { role: 'BUYER' }, queryParamMap: convertToParamMap({}), fragment: null } } },
    ],
  });
  const fixture = TestBed.createComponent<Login | Register>(component);
  await fixture.whenStable();
  const form = fixture.debugElement.query(By.directive(NgForm)).injector.get(NgForm);
  return { fixture, form, iam, response };
}

const valid = { username: 'buyer@example.com', password: 'Password123', confirmPassword: 'Password123', name: 'Company', ruc: '20123456789', address: 'Address', phone: '+51 987-654-321', sector: 'Industry' };

describe('authentication form validation', () => {
  afterEach(() => history.replaceState(null, ''));

  it('blocks empty login and registration and displays required messages', async () => {
    for (const component of [Login, Register]) {
      TestBed.resetTestingModule();
      const { fixture, form, iam } = await setup(component);
      fixture.componentInstance.submit(form);
      await fixture.whenStable();
      expect(iam.signIn).not.toHaveBeenCalled();
      expect(iam.signUp).not.toHaveBeenCalled();
      expect(fixture.nativeElement.textContent).toContain('auth.validation.email-required');
      expect(fixture.nativeElement.textContent).toContain('auth.validation.password-required');
    }
  });

  it('rejects invalid email, short password, invalid RUC, blank company and phone letters', async () => {
    const { fixture, form, iam } = await setup(Register);
    form.control.setValue({ username: 'invalid', password: 'short', confirmPassword: 'short', name: '   ', ruc: '1234ABC', address: '   ', phone: 'abc', sector: '   ' });
    fixture.componentInstance.submit(form);
    await fixture.whenStable();
    expect(iam.signUp).not.toHaveBeenCalled();
    for (const key of ['email-invalid', 'password-length', 'company-required', 'ruc-invalid', 'address-required', 'phone-invalid', 'sector-required']) {
      expect(fixture.nativeElement.textContent).toContain(`auth.validation.${key}`);
    }
  });

  it('allows valid registration, prevents duplicate sends and handles a duplicate RUC', async () => {
    const { fixture, form, iam, response } = await setup(Register);
    form.control.setValue(valid);
    fixture.componentInstance.submit(form);
    fixture.componentInstance.submit(form);
    expect(iam.signUp).toHaveBeenCalledTimes(1);
    response.error({ status: 409, error: { code: 'BUYER COMPANY_CONFLICT' } });
    await fixture.whenStable();
    expect(fixture.componentInstance.error()).toBe('auth.error.buyer-conflict');
  });

  it('shows and hides the registration password without submitting', async () => {
    const { fixture, iam } = await setup(Register);
    const button = fixture.nativeElement.querySelector('.iam-password-toggle') as HTMLButtonElement;
    const password = fixture.nativeElement.querySelector('[name="password"]') as HTMLInputElement;
    expect(password.type).toBe('password');
    button.click();
    await fixture.whenStable();
    expect(password.type).toBe('text');
    expect(button.getAttribute('aria-pressed')).toBe('true');
    button.click();
    await fixture.whenStable();
    expect(password.type).toBe('password');
    expect(iam.signUp).not.toHaveBeenCalled();
  });

  it('shows and hides the password and its confirmation together', async () => {
    const { fixture } = await setup(Register);
    const button = fixture.nativeElement.querySelector('.iam-password-toggle') as HTMLButtonElement;
    const fields = ['password', 'confirmPassword'].map(name => fixture.nativeElement.querySelector(`[name="${name}"]`) as HTMLInputElement);
    expect(fields.map(field => field.type)).toEqual(['password', 'password']);
    button.click();
    await fixture.whenStable();
    expect(fields.map(field => field.type)).toEqual(['text', 'text']);
    button.click();
    await fixture.whenStable();
    expect(fields.map(field => field.type)).toEqual(['password', 'password']);
  });

  it('blocks registration when the passwords do not match and never sends the confirmation', async () => {
    const { fixture, form, iam } = await setup(Register);
    form.control.setValue({ ...valid, confirmPassword: 'Password124' });
    fixture.componentInstance.submit(form);
    await fixture.whenStable();
    expect(iam.signUp).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('#register-confirm-error').textContent).toContain('auth.validation.password-mismatch');
    expect(fixture.nativeElement.querySelector('[name="confirmPassword"]').getAttribute('aria-invalid')).toBe('true');
    form.controls['confirmPassword'].setValue('Password123');
    fixture.componentInstance.submit(form);
    await fixture.whenStable();
    expect(iam.signUp).toHaveBeenCalledTimes(1);
    expect(iam.signUp.mock.calls[0]).toEqual([expect.not.objectContaining({ confirmPassword: expect.anything() })]);
    expect(fixture.nativeElement.querySelector('#register-confirm-error').textContent.trim()).toBe('');
  });

  it('enters the dashboard with the account-created mark after a successful registration', async () => {
    const { fixture, form, response } = await setup(Register);
    const navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    form.control.setValue(valid);
    fixture.componentInstance.submit(form);
    response.next({});
    expect(navigateByUrl).toHaveBeenCalledWith('/dashboard', { state: { accountCreated: true } });
  });

  it('redirects to login with a notice when the account was created but the sign-in failed', async () => {
    const { fixture, form, response } = await setup(Register);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    form.control.setValue(valid);
    fixture.componentInstance.submit(form);
    response.error(new SignInAfterSignUpError());
    await fixture.whenStable();
    expect(fixture.componentInstance.error()).toBe('');
    expect(navigate).toHaveBeenCalledWith(['/login'], { queryParams: {}, state: { accountCreated: true, username: 'buyer@example.com' } });

    TestBed.resetTestingModule();
    history.replaceState({ accountCreated: true, username: 'buyer@example.com' }, '');
    const login = await setup(Login);
    expect(login.fixture.nativeElement.querySelector('[role="status"]').textContent).toContain('auth.login.account-created');
    expect((login.fixture.nativeElement.querySelector('[name="username"]') as HTMLInputElement).value).toBe('buyer@example.com');
  });

  it('shows no account-created notice on a regular login', async () => {
    const { fixture } = await setup(Login);
    expect(fixture.nativeElement.textContent).not.toContain('auth.login.account-created');
    expect((fixture.nativeElement.querySelector('[name="username"]') as HTMLInputElement).value).toBe('');
  });

  it('distinguishes a failed sign-up from a failed sign-in after the account was created', () => {
    const api = { signUp: vi.fn(() => throwError(() => ({ status: 409 }))), signIn: vi.fn(() => throwError(() => ({ status: 500 }))) };
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: IamApi, useValue: api }] });
    const store = TestBed.inject(IamStore);
    const errors: unknown[] = [];
    store.signUp(valid as any).subscribe({ error: error => errors.push(error) });
    api.signUp.mockReturnValue(of({}) as any);
    store.signUp(valid as any).subscribe({ error: error => errors.push(error) });
    expect(errors[0]).toEqual({ status: 409 });
    expect(errors[1]).toBeInstanceOf(SignInAfterSignUpError);
  });

  it('rejects invalid login email and explains incorrect credentials', async () => {
    const { fixture, form, iam, response } = await setup(Login);
    form.control.setValue({ username: 'invalid', password: 'existing-password' });
    fixture.componentInstance.submit(form);
    expect(iam.signIn).not.toHaveBeenCalled();
    form.controls['username'].setValue('buyer@example.com');
    fixture.componentInstance.submit(form);
    expect(iam.signIn).toHaveBeenCalledTimes(1);
    response.error({ status: 400, error: { code: 'VALIDATION_ERROR' } });
    await fixture.whenStable();
    expect(fixture.componentInstance.error()).toBe('auth.error.credentials');
  });
});
