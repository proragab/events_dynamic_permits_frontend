import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PermitsApiService } from '../../../core/api/permits-api.service';
import { Lookup } from '../../../shared/models/api.models';
import { adminErrorMessage } from '../admin-error';

@Component({ selector: 'app-lookup-list', imports: [FormsModule, RouterLink], template: `
  <header class="admin-page-header"><div><a class="admin-breadcrumb" routerLink="/admin">Administration</a><p class="eyebrow">REFERENCE DATA</p>
    <h1>Lookups</h1><p>Manage reusable value lists in a dedicated workspace.</p></div>
    <a class="admin-button primary" routerLink="/admin/lookups/new">New lookup</a></header>
  <div class="admin-toolbar"><label class="admin-search"><span>Search lookups</span><input [(ngModel)]="query" placeholder="Name or code…"></label><span>{{ filtered().length }} of {{ lookups().length }}</span></div>
  @if (error()) { <div class="admin-alert error">{{ error() }}</div> }
  @if (loading()) { <div class="admin-empty">Loading lookups…</div> }
  @else if (!filtered().length) { <div class="admin-empty"><h2>No lookups found</h2><p>Change the search or create a new lookup.</p></div> }
  @else { <div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Lookup</th><th>Code</th><th>Values</th><th>Status</th><th></th></tr></thead>
    <tbody>@for (lookup of filtered(); track lookup.code) { <tr><td><strong>{{ lookup.nameEn }}</strong><small>{{ lookup.nameAr }}</small></td>
      <td><code>{{ lookup.code }}</code></td><td>{{ lookup.values.length }}</td><td><span class="admin-badge" [class.inactive]="!lookup.active">{{ lookup.active ? 'Active' : 'Inactive' }}</span></td>
      <td><a class="admin-link" [routerLink]="['/admin/lookups', lookup.code, 'edit']">Edit</a></td></tr> }</tbody></table></div> }
` })
export class LookupListComponent {
  private readonly api = inject(PermitsApiService); private readonly destroyRef = inject(DestroyRef);
  readonly lookups = signal<Lookup[]>([]); readonly loading = signal(true); readonly error = signal(''); query = '';
  filtered(): Lookup[] { const q = this.query.trim().toLowerCase(); return this.lookups().filter((item) => !q || [item.code, item.nameEn, item.nameAr].some((value) => value.toLowerCase().includes(q))); }
  constructor() { this.api.adminLookups().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (items) => { this.lookups.set(items); this.loading.set(false); }, error: (error) => { this.error.set(adminErrorMessage(error)); this.loading.set(false); } }); }
}
