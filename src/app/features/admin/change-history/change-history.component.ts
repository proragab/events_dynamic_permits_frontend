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
  templateUrl: './change-history.component.html',
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
