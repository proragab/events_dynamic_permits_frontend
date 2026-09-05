import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PermitsApiService } from '../../core/api/permits-api.service';
import { LocaleService } from '../../core/i18n/locale.service';
import { ApiProblem, WorkflowTask } from '../../shared/models/api.models';

@Component({
  selector: 'app-task-queue',
  imports: [FormsModule, RouterLink],
  templateUrl: './task-queue.component.html',
  styleUrl: './task-queue.component.scss',
})
export class TaskQueueComponent {
  private readonly api = inject(PermitsApiService);
  private readonly destroyRef = inject(DestroyRef);
  readonly locale = inject(LocaleService);
  readonly tasks = signal<WorkflowTask[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly search = signal('');
  readonly status = signal('ALL');
  readonly filteredTasks = computed(() => {
    const term = this.search().trim().toLowerCase();
    return this.tasks().filter((task) => {
      const matchesStatus = this.status() === 'ALL' || task.status === this.status();
      const searchable = [task.titleEn, task.titleAr, task.subjectType, String(task.subjectId), task.stepCode, task.workflowCode, task.roleCode ?? ''].join(' ').toLowerCase();
      return matchesStatus && (!term || searchable.includes(term));
    });
  });
  readonly readyCount = computed(() => this.tasks().filter((task) => task.status === 'READY').length);
  readonly claimedCount = computed(() => this.tasks().filter((task) => task.status === 'IN_PROGRESS').length);
  readonly eventCount = computed(() => this.tasks().filter((task) => task.subjectType === 'EVENT').length);
  readonly permitCount = computed(() => this.tasks().filter((task) => task.subjectType === 'PERMIT').length);

  constructor() { this.loadQueue(); }

  loadQueue(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.tasks().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (tasks) => { this.tasks.set(tasks); this.loading.set(false); },
      error: (error) => this.fail(error),
    });
  }

  setSearch(value: string): void { this.search.set(value); }
  setStatus(value: string): void { this.status.set(value); }
  subjectLabel(task: WorkflowTask): string { return task.subjectType === 'EVENT' ? 'Event review' : 'Permit review'; }
  statusLabel(status: string): string { return status === 'READY' ? 'Ready to claim' : 'In progress'; }
  dueLabel(value: string | null): string {
    if (!value) return 'No due date';
    return `Due ${new Intl.DateTimeFormat('en-SA', { dateStyle: 'medium' }).format(new Date(value))}`;
  }

  private fail(error: unknown): void {
    const response = error as HttpErrorResponse;
    const problem = response.error as ApiProblem | undefined;
    this.error.set(problem?.detail || response.message || 'The task queue could not be loaded.');
    this.loading.set(false);
  }
}
