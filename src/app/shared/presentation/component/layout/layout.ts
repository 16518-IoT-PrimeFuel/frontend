import { Component, OnInit, ViewChild, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { BreakpointObserver } from '@angular/cdk/layout';
import { RouterOutlet, RouterLink } from '@angular/router';
import { LanguageSwitcher } from '../language-switcher/language-switcher';
import { MatExpansionModule } from '@angular/material/expansion';
import { IamStore } from '../../../../iam/application/iam.store';
import { MatBadgeModule } from '@angular/material/badge';
import { NotificationStore } from '../../../../notification/application/notification.store';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [
    CommonModule,
    MatSidenavModule,
    MatToolbarModule,
    MatExpansionModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatBadgeModule,
    TranslatePipe,
    RouterOutlet,
    RouterLink,
    LanguageSwitcher,
  ],
  templateUrl: './layout.html',
  styleUrl: './layout.css',
})
export class Layout implements OnInit {
  private readonly iam = inject(IamStore);
  protected readonly notifications = inject(NotificationStore);
  @ViewChild(MatSidenav) drawer!: MatSidenav;

  sidenavMode: 'side' | 'over' = 'side';
  sidenavOpened = true;

  ngOnInit(): void { this.notifications.refreshUnreadCount(); }

  options = [
    { label: 'nav.profile', icon: 'person', link: '/profile', roles: ['BUYER', 'PROVIDER'] },
    { label: 'nav.equipment', icon: 'oil_barrel', link: '/tanks', roles: ['BUYER'] },
    { label: 'nav.dashboard', icon: 'dashboard', link: '/dashboard', roles: ['BUYER', 'PROVIDER'] },
    {
      label: 'nav.inventory',
      icon: 'inventory_2',
      link: '/fuel-products',
      roles: ['BUYER', 'PROVIDER'],
      children: [
        { label: 'inventory.product-inventory', link: '/fuel-products', roles: ['PROVIDER'] },
        { label: 'inventory.add-product', link: '/fuel-products/product-form', roles: ['PROVIDER'] },
        { label: 'inventory.catalog', link: '/fuel-products', roles: ['BUYER'] },
      ]
    },
    {
      label: 'nav.ordering',
      icon: 'shopping_cart',
      link: '/ordering',
      roles: ['BUYER', 'PROVIDER'],
      children: [
        { label: 'ordering.requests', link: '/ordering/request-list' },
        { label: 'ordering.create-request', link: '/ordering/request-form' },
        { label: 'ordering.orders', link: '/ordering/order-list' },
      ],
    },
    {
      label: 'nav.fulfillment',
      icon: 'local_shipping',
      link: '/fulfillment',
      roles: ['PROVIDER'],
      children: [
        { label: 'fulfillment.vehicles', link: '/fulfillment/tanker-list' },
        { label: 'fulfillment.drivers', link: '/fulfillment/driver-list' },
      ],
    },
    {
      label: 'nav.reports',
      icon: 'analytics',
      link: '/reporting/report-main',
      roles: ['PROVIDER'],
    },
    { label: 'nav.admin', icon: 'admin_panel_settings', link: '/admin', roles: [], admin: true },
  ];

  get visibleOptions() { return this.options.filter((option: any) => option.admin ? this.iam.isAdmin() : option.roles.includes(this.iam.role() ?? '')); }
  visibleChildren(option: any) { return option.children?.filter((child: any) => !child.roles || child.roles.includes(this.iam.role() ?? '')) ?? []; }

  constructor(
    private router: Router,
    private observer: BreakpointObserver,
  ) {
    this.observer.observe(['(max-width: 768px)']).subscribe((result) => {
      if (result.matches) {
        this.sidenavMode = 'over';
        this.sidenavOpened = false;
      } else {
        this.sidenavMode = 'side';
        this.sidenavOpened = true;
      }
    });
  }

  navigateTo(link: string): void {
    this.router.navigate([link]).then();
    if (this.sidenavMode === 'over') {
      this.drawer.toggle().then();
    }
  }

  isActive(link: string): boolean {
    return this.router.url.startsWith(link);
  }

  getCurrentYear(): number {
    return new Date().getFullYear();
  }

  logout(): void { this.iam.logout(); }
}
