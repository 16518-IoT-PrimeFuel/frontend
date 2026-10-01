import { TestBed } from '@angular/core/testing';
import { NgForm } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { signal } from '@angular/core';
import { Subject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { IamStore } from '../../application/iam.store';
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

describe('authentication form validation', () => {
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
    form.control.setValue({ username: 'invalid', password: 'short', name: '   ', ruc: '1234ABC', address: '   ', phone: 'abc', sector: '   ' });
    fixture.componentInstance.submit(form);
    await fixture.whenStable();
    expect(iam.signUp).not.toHaveBeenCalled();
    for (const key of ['email-invalid', 'password-length', 'company-required', 'ruc-invalid', 'address-required', 'phone-invalid', 'sector-required']) {
      expect(fixture.nativeElement.textContent).toContain(`auth.validation.${key}`);
    }
  });

  it('allows valid registration, prevents duplicate sends and handles a duplicate RUC', async () => {
    const { fixture, form, iam, response } = await setup(Register);
    form.control.setValue({ username: 'buyer@example.com', password: 'Password123', name: 'Company', ruc: '20123456789', address: 'Address', phone: '+51 987-654-321', sector: 'Industry' });
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
