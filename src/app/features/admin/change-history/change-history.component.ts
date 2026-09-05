import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { PermitsApiService } from '../../../core/api/permits-api.service';
import { PermitType, SchemaChange } from '../../../shared/models/api.models';
import { adminErrorMessage } from '../admin-error';

@Component({
  selector: 'app-change-history',
  imports: [FormsModule, RouterLink],
  template: `
    <header class="admin-page-header">
      <div><a class="admin-breadcrumb" routerLink="/admin">Administration</a><p class="eyebrow">AUDIT TRAIL</p>
        <h1>Permit Change History</h1><p>Review physical schema changes across all permit types or focus on one definition.</p></div>
      <button class="admin-button secondary" type="button" (click)="load()" [disabled]="loading()">Refresh</button>
    </header>
    <section class="admin-history-summary" aria-label="Change summary">
      <article><strong>{{ changes().length }}</strong><span>Total changes</span></article>
      <article><strong>{{ countStatus('APPLIED') }}</strong><span>Applied</span></article>
      <article><strong>{{ countStatus('PLANNED') + countStatus('APPROVED') }}</strong><span>Pending</span></article>
      <article [class.has-failures]="countStatus('FAILED') > 0"><strong>{{ countStatus('FAILED') }}</strong><span>Failed</span></article>
    </section>
    <section class="admin-toolbar admin-history-filters">
      <label><span>Permit type</span><select [(ngModel)]="selectedPermitType"><option value="ALL">All permit types</option>
        @for (type of types(); track type.code) { <option [value]="type.code">{{ type.nameEn }} ({{ type.code }})</option> }
      </select></label>
      <label><span>Status</span><select [(ngModel)]="selectedStatus"><option value="ALL">All statuses</option><option value="PLANNED">Planned</option><option value="APPROVED">Approved</option><option value="APPLIED">Applied</option><option value="FAILED">Failed</option><option value="REJECTED">Rejected</option></select></label>
      <label class="admin-search"><span>Search changes</span><input [(ngModel)]="query" placeholder="Operation, target, reason, actor..."></label>
      <span>{{ filteredChanges().length }} results</span>
    </section>
    @if (error()) { <div class="admin-alert error">{{ error() }}</div> }
    @if (loading()) { <div class="admin-empty">Loading permit change history...</div> }
    @else if (!filteredChanges().length) { <div class="admin-empty"><h2>No changes found</h2><p>No schema changes match the selected filters.</p></div> }
    @else {
      <div class="admin-table-wrap"><table class="admin-table admin-history-table">
        <thead><tr><th>Permit type</th><th>Change</th><th>Target</th><th>Status</th><th>Requested</th><th>Applied</th><th></th></tr></thead>
        <tbody>@for (change of filteredChanges(); track change.id) {
          <tr [class.admin-history-row-open]="expandedChangeId() === change.id">
            <td><a class="admin-link" [routerLink]="['/admin/permit-types', change.permitTypeCode, 'edit']">{{ permitTypeName(change.permitTypeCode!) }}</a><small><code>{{ change.permitTypeCode }}</code></small></td>
            <td><strong>{{ operationLabel(change.operation) }}</strong><small>#{{ change.id }} - by {{ change.createdBy }}</small></td>
            <td><code>{{ change.target }}</code>@if (change.reason) { <small>{{ change.reason }}</small> }@if (change.error) { <small class="admin-history-error">{{ change.error }}</small> }</td>
            <td><span class="admin-badge" [class.pending]="isPending(change)" [class.failed]="isFailed(change)">{{ change.status }}</span></td>
            <td>{{ formatDate(change.createdAt || change.appliedAt) }}</td><td>{{ formatDate(change.appliedAt) }}</td>
            <td><button class="admin-link-button" type="button" (click)="toggleDetails(change.id)" [attr.aria-expanded]="expandedChangeId() === change.id">{{ expandedChangeId() === change.id ? 'Hide details' : 'View details' }}</button></td>
          </tr>
          @if (expandedChangeId() === change.id) {
            <tr class="admin-history-detail-row"><td colspan="7">
              <section class="admin-history-detail" [attr.aria-label]="'Change ' + change.id + ' details'">
                <header><div><p class="eyebrow">CHANGE #{{ change.id }}</p><h2>{{ operationLabel(change.operation) }}</h2></div>
                  <span class="admin-badge" [class.pending]="isPending(change)" [class.failed]="isFailed(change)">{{ change.status }}</span></header>
                <dl class="admin-history-detail-grid">
                  <div><dt>Permit type</dt><dd>{{ permitTypeName(change.permitTypeCode!) }} <code>{{ change.permitTypeCode }}</code></dd></div>
                  <div><dt>Target</dt><dd><code>{{ change.target }}</code></dd></div>
                  <div><dt>Requested by</dt><dd>{{ change.createdBy }}</dd></div>
                  <div><dt>Requested at</dt><dd>{{ formatDate(change.createdAt || change.appliedAt) }}</dd></div>
                  <div><dt>Approved by</dt><dd>{{ change.approvedBy || '-' }}</dd></div>
                  <div><dt>Applied at</dt><dd>{{ formatDate(change.appliedAt) }}</dd></div>
                  <div><dt>Estimated rows</dt><dd>{{ change.rowEstimate ?? '-' }}</dd></div>
                  <div><dt>Metadata-only operation</dt><dd>{{ change.metadataOnly === null ? '-' : (change.metadataOnly ? 'Yes' : 'No') }}</dd></div>
                </dl>
                @if (change.reason) { <div class="admin-history-detail-block"><h3>Reason</h3><p>{{ change.reason }}</p></div> }
                @if (change.error) { <div class="admin-history-detail-block error"><h3>Failure details</h3><p>{{ change.error }}</p></div> }
                <div class="admin-history-detail-block sql">
                  <div class="admin-history-sql-heading"><div><h3>SQL statement</h3><p>{{ change.status === 'APPLIED' ? 'Executed successfully' : 'Generated for this schema operation' }}</p></div>
                    <button class="admin-button secondary" type="button" (click)="copySql(change)">{{ copiedChangeId() === change.id ? 'Copied' : 'Copy SQL' }}</button></div>
                  <pre><code>{{ change.sql }}</code></pre>
                </div>
              </section>
            </td></tr>
          }
        }</tbody>
      </table></div>
    }
  `,
})
export class ChangeHistoryComponent {
  private readonly api = inject(PermitsApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  readonly types = signal<PermitType[]>([]);
  readonly changes = signal<SchemaChange[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly expandedChangeId = signal<number | null>(null);
  readonly copiedChangeId = signal<number | null>(null);
  selectedPermitType = this.route.snapshot.queryParamMap.get('permitType') ?? 'ALL';
  selectedStatus = 'ALL';
  query = '';

  constructor() { this.load(); }

  load(): void {
    this.loading.set(true); this.error.set(''); this.expandedChangeId.set(null);
    this.api.adminPermitTypes().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (types) => {
        this.types.set(types);
        if (!types.length) { this.changes.set([]); this.loading.set(false); return; }
        forkJoin(types.map((type) => this.api.schemaChanges(type.code))).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
          next: (histories) => {
            const changes = histories.flatMap((history, index) => history.map((change) => ({ ...change, permitTypeCode: types[index].code })));
            changes.sort((left, right) => this.changeTime(right) - this.changeTime(left) || right.id - left.id);
            this.changes.set(changes); this.loading.set(false);
          }, error: (error) => this.fail(error),
        });
      }, error: (error) => this.fail(error),
    });
  }
  filteredChanges(): SchemaChange[] {
    const query = this.query.trim().toLowerCase();
    return this.changes().filter((change) =>
      (this.selectedPermitType === 'ALL' || change.permitTypeCode === this.selectedPermitType) &&
      (this.selectedStatus === 'ALL' || change.status === this.selectedStatus) &&
      (!query || [change.permitTypeCode, change.operation, change.target, change.reason, change.createdBy, change.approvedBy, change.error].some((value) => value?.toLowerCase().includes(query))),
    );
  }
  countStatus(status: SchemaChange['status']): number { return this.changes().filter((change) => change.status === status).length; }
  toggleDetails(id: number): void { this.expandedChangeId.update((current) => current === id ? null : id); this.copiedChangeId.set(null); }
  async copySql(change: SchemaChange): Promise<void> { await navigator.clipboard.writeText(change.sql); this.copiedChangeId.set(change.id); setTimeout(() => { if (this.copiedChangeId() === change.id) this.copiedChangeId.set(null); }, 1800); }
  isPending(change: SchemaChange): boolean { return change.status === 'PLANNED' || change.status === 'APPROVED'; }
  isFailed(change: SchemaChange): boolean { return change.status === 'FAILED' || change.status === 'REJECTED'; }
  permitTypeName(code: string): string { return this.types().find((type) => type.code === code)?.nameEn ?? code; }
  operationLabel(operation: string): string { return operation.split('_').map((part) => part.charAt(0) + part.slice(1).toLowerCase()).join(' '); }
  formatDate(value: string | null | undefined): string { if (!value) return '-'; const date = new Date(value.endsWith('Z') ? value : value + 'Z'); return Number.isNaN(date.getTime()) ? '-' : new Intl.DateTimeFormat('en-SA', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Riyadh' }).format(date); }
  private changeTime(change: SchemaChange): number { const value = change.createdAt || change.appliedAt; return value ? new Date(value.endsWith('Z') ? value : value + 'Z').getTime() : 0; }
  private fail(error: unknown): void { this.error.set(adminErrorMessage(error)); this.loading.set(false); }
}
