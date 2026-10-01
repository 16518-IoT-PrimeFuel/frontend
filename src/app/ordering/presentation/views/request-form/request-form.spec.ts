import { beforeEach, describe, expect, it } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { RequestForm } from './request-form';
import { EquipmentStore } from '../../../../equipment/application/equipment.store';

describe('RequestForm', () => {
  let fixture: ComponentFixture<RequestForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RequestForm, TranslateModule.forRoot()],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
        { provide: EquipmentStore, useValue: { resolveCustomer: () => of({ id: 4, name: 'ACME', active: true }) } }],
    }).compileComponents();
    fixture = TestBed.createComponent(RequestForm);
    await fixture.whenStable();
  });

  it('uses the resolved account and has no customer selector', () => {
    expect(fixture.componentInstance.customerAccountId()).toBe(4);
    expect('customerAccountId' in fixture.componentInstance.form.controls).toBe(false);
  });
});
