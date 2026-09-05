import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PermitsApiService } from '../../../core/api/permits-api.service';
import { PermitType } from '../../../shared/models/api.models';
import { adminErrorMessage } from '../admin-error';

@Component({
  selector: 'app-permit-type-list',
  imports: [FormsModule, RouterLink],
  template: `
    <header class="admin-page-header">
      <div><a class="admin-breadcrumb" routerLink="/admin">Administration</a><p class="eyebrow">CATALOG</p>
        <h1>Permit Types</h1><p>Create and maintain permit definitions without mixing them with other settings.</p></div>
      <a class="admin-button primary" routerLink="/admin/permit-types/new">New permit type</a>
    </header>
    <div class="admin-toolbar">
      <label class="admin-search"><span>Search permit types</span><input [(ngModel)]="query" placeholder="Name, code, category, workflow…"></label>
      <span>{{ filtered().length }} of {{ types().length }}</span>
    </div>
    @if (error()) { <div class="admin-alert error">{{ error() }}</div> }
    @if (loading()) { <div class="admin-empty">Loading permit types…</div> }
    @else if (!filtered().length) { <div class="admin-empty"><h2>No permit types found</h2><p>Change the search or create a new permit type.</p></div> }
    @else {
      <div class="admin-table-wrap"><table class="admin-table">
        <thead><tr><th>Permit type</th><th>Code</th><th>Workflow</th><th>Revision</th><th>Status</th><th></th></tr></thead>
        <tbody>@for (type of filtered(); track type.code) {
          <tr><td><strong>{{ type.nameEn }}</strong><small>{{ type.nameAr }}</small></td><td><code>{{ type.code }}</code></td>
          <td>{{ type.workflowCode || 'Not assigned' }}</td><td>v{{ type.catalogRev }}</td>
          <td><span class="admin-badge" [class.inactive]="!type.active">{{ type.active ? 'Active' : 'Inactive' }}</span></td>
          <td><a class="admin-link" [routerLink]="['/admin/permit-types', type.code, 'edit']">Edit</a></td></tr>
        }</tbody>
      </table></div>
    }
  `,
})
export class PermitTypeListComponent {
  private readonly api = inject(PermitsApiService);
  private readonly destroyRef = inject(DestroyRef);
  readonly types = signal<PermitType[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  query = '';
  filtered(): PermitType[] {
    const q = this.query.trim().toLowerCase();
    return this.types().filter((type) => !q || [type.code, type.nameEn, type.nameAr, type.category, type.workflowCode].some((value) => value?.toLowerCase().includes(q)));
  }
  constructor() {
    this.api.adminPermitTypes().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (types) => { this.types.set(types); this.loading.set(false); },
      error: (error) => { this.error.set(adminErrorMessage(error)); this.loading.set(false); },
    });
  }
}
