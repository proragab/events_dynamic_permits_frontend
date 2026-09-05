import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PermitsApiService } from '../../../core/api/permits-api.service';
import { WorkflowDefinition } from '../../../shared/models/api.models';
import { adminErrorMessage } from '../admin-error';

@Component({ selector: 'app-workflow-list', imports: [FormsModule, RouterLink], templateUrl: './workflow-list.component.html' })
export class WorkflowListComponent {
  private readonly api = inject(PermitsApiService); private readonly destroyRef = inject(DestroyRef);
  readonly workflows = signal<WorkflowDefinition[]>([]); readonly loading = signal(true); readonly error = signal(''); query = '';
  filtered(): WorkflowDefinition[] { const q = this.query.trim().toLowerCase(); return this.workflows().filter((item) => !q || [item.code, item.nameEn, item.nameAr, item.subjectCode, item.subjectType].some((value) => value.toLowerCase().includes(q))); }
  constructor() { this.api.workflows().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (items) => { this.workflows.set(items); this.loading.set(false); }, error: (error) => { this.error.set(adminErrorMessage(error)); this.loading.set(false); } }); }
}
