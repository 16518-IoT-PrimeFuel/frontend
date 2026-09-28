import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

@Component({ standalone: true, imports: [RouterLink, TranslatePipe], template: '<main class="iam-page"><section class="iam-card"><h1>{{ "auth.denied.title" | translate }}</h1><p>{{ "auth.denied.message" | translate }}</p><a routerLink="/login">{{ "auth.login.link" | translate }}</a></section></main>' })
export class AccessDenied {}
