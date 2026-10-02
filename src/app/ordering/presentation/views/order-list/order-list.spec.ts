import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OrderList } from './order-list';
import { TranslateModule } from '@ngx-translate/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

describe('OrderList', () => {
  let component: OrderList;
  let fixture: ComponentFixture<OrderList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrderList, TranslateModule.forRoot()],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    })
    .compileComponents();

    fixture = TestBed.createComponent(OrderList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
