import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-admin-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <div class="admin-shell">
      <aside class="admin-sidebar">
        <a class="admin-sidebar__brand" routerLink="/admin">
          <span class="admin-sidebar__mark">A</span>
          <span><strong>Administration</strong><small>Platform configuration</small></span>
        </a>
        <nav aria-label="Administration sections">
          <a routerLink="/admin" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">
            <span>Overview</span><small>Console home</small>
          </a>
          <a routerLink="/admin/permit-types" routerLinkActive="active">
            <span>Permit Types</span><small>Forms and schemas</small>
          </a>
          <a routerLink="/admin/lookups" routerLinkActive="active">
            <span>Lookups</span><small>Reusable values</small>
          </a>
          <a routerLink="/admin/workflows" routerLinkActive="active">
            <span>Workflows</span><small>Roles and approval steps</small>
          </a>
          <a routerLink="/admin/change-history" routerLinkActive="active">
            <span>Change History</span><small>Permit schema audit</small>
          </a>
        </nav>
      </aside>
      <section class="admin-content"><router-outlet /></section>
    </div>
  `,
})
export class AdminShellComponent {}
