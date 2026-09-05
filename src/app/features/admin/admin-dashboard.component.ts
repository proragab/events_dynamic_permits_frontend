import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { PermitsApiService } from '../../core/api/permits-api.service';
import { adminErrorMessage } from './admin-error';

@Component({
  selector: 'app-admin-dashboard',
  imports: [RouterLink],
  template: `
    <header class="admin-page-header">
      <div><p class="eyebrow">ADMIN CONSOLE</p><h1>Platform configuration</h1>
        <p>Manage each configuration area in its own workspace.</p></div>
    </header>

    @if (error()) { <div class="admin-alert error">{{ error() }}</div> }

    <section class="admin-dashboard-grid" aria-label="Configuration areas">
      <a class="admin-module-card" routerLink="/admin/permit-types">
        <span class="admin-module-card__icon">PT</span>
        <div><h2>Permit Types</h2><p>Design permit forms, fields, and physical schemas.</p></div>
        <strong>{{ loading() ? '…' : permitCount() }}</strong><small>configured</small>
      </a>
      <a class="admin-module-card" routerLink="/admin/lookups">
        <span class="admin-module-card__icon">LU</span>
        <div><h2>Lookups</h2><p>Maintain reusable value lists used by permit fields.</p></div>
        <strong>{{ loading() ? '…' : lookupCount() }}</strong><small>configured</small>
      </a>
      <a class="admin-module-card" routerLink="/admin/workflows">
        <span class="admin-module-card__icon">WF</span>
        <div><h2>Workflows</h2><p>Assign approval tasks to roles and control routing.</p></div>
        <strong>{{ loading() ? '…' : workflowCount() }}</strong><small>configured</small>
      </a>
      <a class="admin-module-card" routerLink="/admin/change-history">
        <span class="admin-module-card__icon">CH</span>
        <div><h2>Change History</h2><p>Review physical permit schema changes and their outcome.</p></div>
        <strong>View</strong><small>audit trail</small>
      </a>
    </section>

    <section class="admin-panel admin-getting-started">
      <div><p class="eyebrow">RECOMMENDED ORDER</p><h2>Configure with confidence</h2></div>
      <ol>
        <li><strong>Create lookups</strong><span>Add values used by selection fields.</span></li>
        <li><strong>Build workflows</strong><span>Assign every human task to a platform role.</span></li>
        <li><strong>Create permit types</strong><span>Add fields, review the schema plan, then apply it.</span></li>
      </ol>
    </section>
  `,
})
export class AdminDashboardComponent {
  private readonly api = inject(PermitsApiService);
  private readonly destroyRef = inject(DestroyRef);
  readonly permitCount = signal(0);
  readonly lookupCount = signal(0);
  readonly workflowCount = signal(0);
  readonly loading = signal(true);
  readonly error = signal('');

  constructor() {
    forkJoin({ types: this.api.adminPermitTypes(), lookups: this.api.adminLookups(), workflows: this.api.workflows() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ types, lookups, workflows }) => {
          this.permitCount.set(types.length);
          this.lookupCount.set(lookups.length);
          this.workflowCount.set(workflows.length);
          this.loading.set(false);
        },
        error: (error) => { this.error.set(adminErrorMessage(error)); this.loading.set(false); },
      });
  }
}
