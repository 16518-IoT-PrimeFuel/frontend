import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { IamStore } from '../../../application/iam.store';
import { IamApi } from '../../../infrastructure/iam-api';
import { Profile } from './profile';

const company = { id: 11, name: 'ACME', ruc: '20123456789', sector: 'Industry', address: 'Address', contactEmail: 'acme@example.com', phone: '987654321' };
const organization = { id: 5, name: 'ACME', type: 'CUSTOMER', role: 'OWNER' };

async function setup(tab: 'company' | 'organizations') {
  const api = {
    getUser: vi.fn(() => of({ id: 1, username: 'buyer@example.com', roles: ['ROLE_BUYER'] })),
    getBuyerCompany: vi.fn(() => of({ ...company })),
    updateBuyerCompany: vi.fn(() => of({ ...company })),
    onboardOrganization: vi.fn(() => of(organization)),
    inviteMember: vi.fn(() => of({ id: 9, organizationId: 5, email: 'new@example.com', token: 'token', role: 'MEMBER', status: 'PENDING', expiresAt: null })),
  };
  const iam = { isBuyer: () => true, userId: () => 1, companyId: () => 11, providerId: () => null, organizationId: () => 5, refreshMemberships: () => of([organization]), selectOrganization: () => true };
  TestBed.configureTestingModule({
    imports: [Profile],
    providers: [
      provideTranslateService(),
      { provide: IamApi, useValue: api },
      { provide: IamStore, useValue: iam },
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(tab === 'organizations' ? { tab } : {}) } } },
    ],
  });
  const fixture = TestBed.createComponent(Profile);
  if (tab === 'company') fixture.componentInstance.tab.set(1);
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  const type = async (selector: string, value: string) => {
    const input = element.querySelector(selector) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  };
  const click = async (selector: string) => {
    const button = element.querySelector(selector) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    button.click();
    await fixture.whenStable();
  };
  return { fixture, api, element, type, click };
}

describe('Profile forms', () => {
  it('company: saving with errors shows the messages, focuses the first invalid field and does not call the service', async () => {
    const { api, element, type, click } = await setup('company');
    await type('#companyForm [name="ruc"]', '123');
    await type('#companyForm [name="sector"]', '');
    await click('.foot button');
    expect(api.updateBuyerCompany).not.toHaveBeenCalled();
    expect(element.querySelector('#companyForm')!.textContent).toContain('profile.ruc-invalid');
    expect(element.querySelector('#companyForm')!.textContent).toContain('validation.required');
    expect(document.activeElement).toBe(element.querySelector('#companyForm [name="ruc"]'));
  });

  it('company: explains that there are no changes instead of disabling the button, then saves once edited', async () => {
    const { api, element, type, click } = await setup('company');
    await click('.foot button');
    expect(api.updateBuyerCompany).not.toHaveBeenCalled();
    expect(element.querySelector('.foot [role="status"]')!.textContent).toContain('profile.no-changes');
    await type('#companyForm [name="sector"]', 'Mining');
    expect(element.querySelector('.foot')!.textContent).not.toContain('profile.no-changes');
    await click('.foot button');
    expect(api.updateBuyerCompany).toHaveBeenCalledTimes(1);
    expect(element.querySelector('.foot')!.textContent).toContain('profile.saved');
  });

  it('create organization: submitting with errors shows the messages and requires an 11-digit RUC', async () => {
    const { api, element, type, click } = await setup('organizations');
    await click('#onboardingForm button[type="submit"]');
    expect(api.onboardOrganization).not.toHaveBeenCalled();
    expect(element.querySelector('#onboardingForm')!.textContent).toContain('validation.required');
    expect(document.activeElement).toBe(element.querySelector('#onboardingForm [name="name"]'));
    await type('#onboardingForm [name="name"]', 'New org');
    await type('#onboardingForm [name="ruc"]', '1234ABC');
    await click('#onboardingForm button[type="submit"]');
    expect(api.onboardOrganization).not.toHaveBeenCalled();
    expect(element.querySelector('#onboardingForm')!.textContent).toContain('profile.ruc-invalid');
    expect(document.activeElement).toBe(element.querySelector('#onboardingForm [name="ruc"]'));
    await type('#onboardingForm [name="ruc"]', '20123456789');
    await click('#onboardingForm button[type="submit"]');
    expect(api.onboardOrganization).toHaveBeenCalledWith('New org', '20123456789', 'CUSTOMER');
  });

  it('invite member: submitting with errors shows the messages and does not call the service', async () => {
    const { api, element, type, click } = await setup('organizations');
    await click('#invitationForm button[type="submit"]');
    expect(api.inviteMember).not.toHaveBeenCalled();
    expect(element.querySelector('#invitationForm')!.textContent).toContain('validation.required');
    expect(document.activeElement).toBe(element.querySelector('#invitationForm [name="email"]'));
    await type('#invitationForm [name="email"]', 'invalid');
    await click('#invitationForm button[type="submit"]');
    expect(api.inviteMember).not.toHaveBeenCalled();
    expect(element.querySelector('#invitationForm')!.textContent).toContain('validation.email');
    await type('#invitationForm [name="email"]', 'new@example.com');
    await click('#invitationForm button[type="submit"]');
    expect(api.inviteMember).toHaveBeenCalledWith(5, 'new@example.com', 'MEMBER');
  });
});
