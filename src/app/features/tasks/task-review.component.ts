import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Observable, forkJoin, map, of, switchMap } from 'rxjs';
import { PermitsApiService } from '../../core/api/permits-api.service';
import { LocaleService } from '../../core/i18n/locale.service';
import {
  ApiProblem,
  EventSummary,
  ExternalCheck,
  FileAnswer,
  LookupValue,
  PermitAnswers,
  PermitApplication,
  PermitField,
  PermitForm,
  PermitType,
  TaskOptions,
  WorkflowHistory,
  WorkflowTask,
} from '../../shared/models/api.models';

interface ReviewContext {
  task: WorkflowTask;
  options: TaskOptions;
  history: WorkflowHistory;
  event: EventSummary;
  application: PermitApplication | null;
  applications: PermitApplication[];
  definition: PermitForm | null;
  answers: PermitAnswers | null;
  permitTypes: PermitType[];
  externalCheck: ExternalCheck | null;
}

interface AnswerSection { title: string; fields: PermitField[]; }

@Component({
  selector: 'app-task-review',
  imports: [FormsModule, RouterLink],
  templateUrl: './task-review.component.html',
  styleUrl: './task-review.component.scss',
})
export class TaskReviewComponent {
  private readonly api = inject(PermitsApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  readonly locale = inject(LocaleService);
  readonly taskId = Number(this.route.snapshot.paramMap.get('id'));
  readonly task = signal<WorkflowTask | null>(null);
  readonly options = signal<TaskOptions | null>(null);
  readonly history = signal<WorkflowHistory | null>(null);
  readonly event = signal<EventSummary | null>(null);
  readonly application = signal<PermitApplication | null>(null);
  readonly applications = signal<PermitApplication[]>([]);
  readonly definition = signal<PermitForm | null>(null);
  readonly answers = signal<PermitAnswers | null>(null);
  readonly permitTypes = signal<PermitType[]>([]);
  readonly externalCheck = signal<ExternalCheck | null>(null);
  readonly lookupValues = signal<Record<string, LookupValue[]>>({});
  readonly loading = signal(true);
  readonly working = signal(false);
  readonly error = signal('');
  readonly message = signal('');
  outcome = '';
  comment = '';
  returnTargetStep = '';

  constructor() { this.load(); }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.task(this.taskId).pipe(
      switchMap((task) => this.loadContext(task)),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (context) => {
        this.task.set(context.task);
        this.options.set(context.options);
        this.history.set(context.history);
        this.event.set(context.event);
        this.application.set(context.application);
        this.applications.set(context.applications);
        this.definition.set(context.definition);
        this.answers.set(context.answers);
        this.permitTypes.set(context.permitTypes);
        this.externalCheck.set(context.externalCheck);
        this.outcome = context.options.allowedOutcomes[0] ?? '';
        this.loadLookups(context.definition?.fields ?? []);
        this.loading.set(false);
        this.working.set(false);
      },
      error: (error) => this.fail(error),
    });
  }

  claim(): void {
    const task = this.task();
    if (!task) return;
    this.working.set(true);
    this.error.set('');
    this.api.claimTask(task.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (claimed) => { this.task.set(claimed); this.working.set(false); this.message.set('Task claimed. You can now record your decision.'); },
      error: (error) => this.fail(error),
    });
  }

  decide(): void {
    const task = this.task();
    if (!task || !this.outcome) return;
    this.working.set(true);
    this.error.set('');
    this.message.set('');
    this.api.decideTask(task.id, this.outcome, this.comment.trim(), this.returnTargetStep || null)
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (decided) => {
          this.task.set(decided);
          this.comment = '';
          this.working.set(false);
          this.message.set(`Decision recorded: ${this.outcomeLabel(decided.outcome ?? this.outcome)}.`);
          this.refreshHistory(decided);
        },
        error: (error) => this.fail(error),
      });
  }

  runExternalCheck(): void {
    const task = this.task();
    if (!task) return;
    this.working.set(true);
    this.error.set('');
    this.message.set('');
    this.api.runExternalCheck(task.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        this.externalCheck.set(result);
        this.working.set(false);
        this.message.set(result.status === 'PENDING' ? 'External check started. Refresh after the callback arrives.' : `External check completed: ${this.statusLabel(result.status)}.`);
      },
      error: (error) => this.fail(error),
    });
  }

  refreshExternalCheck(): void {
    const task = this.task();
    if (!task) return;
    this.working.set(true);
    this.api.externalCheck(task.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => { this.externalCheck.set(result); this.working.set(false); },
      error: (error) => this.fail(error),
    });
  }

  externalCheckReady(): boolean {
    const check = this.externalCheck();
    return !check || check.status === 'NOT_CONFIGURED' || ['SUCCESS', 'REJECTED', 'RETURN_APPLICANT'].includes(check.status);
  }

  selectOutcome(value: string): void {
    this.outcome = value;
    if (!value.startsWith('RETURN')) this.returnTargetStep = '';
  }

  outcomeDescription(value: string): string {
    return ({ APPROVED: 'Advance to the next workflow step.', REJECTED: 'Close the subject as rejected.', RETURN_PREVIOUS: 'Send it back to an earlier review step.', RETURN_APPLICANT: 'Return it to the applicant for correction.' } as Record<string, string>)[value] ?? '';
  }

  answerSections(): AnswerSection[] {
    const fields = [...(this.definition()?.fields ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
    const sections = new Map<string, AnswerSection>();
    let current = '_general';
    sections.set(current, { title: 'Application information', fields: [] });
    for (const field of fields) {
      if (field.dataType === 'SECTION') {
        current = field.fieldKey;
        sections.set(current, { title: this.locale.text(field.labelEn, field.labelAr), fields: [] });
        continue;
      }
      const key = field.sectionCode || current;
      if (!sections.has(key)) sections.set(key, { title: this.titleCase(key), fields: [] });
      sections.get(key)!.fields.push(field);
    }
    return [...sections.values()].filter((section) => section.fields.length);
  }

  displayAnswer(field: PermitField): string {
    const value = this.answers()?.answers[field.fieldKey];
    if (value === null || value === undefined || value === '') return 'Not provided';
    if (field.dataType === 'BOOLEAN') return value ? 'Yes' : 'No';
    if (field.dataType === 'FILE' && Array.isArray(value)) {
      return (value as FileAnswer[]).map((file) => file.fileName).join(', ') || 'No files attached';
    }
    if (field.dataType === 'LOOKUP') return this.lookupLabel(field.lookupCode, value);
    if (field.dataType === 'MULTISELECT' && Array.isArray(value)) {
      return value.map((item) => this.lookupLabel(field.lookupCode, item)).join(', ') || 'Not provided';
    }
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  permitTypeName(code: string): string {
    const type = this.permitTypes().find((item) => item.code === code);
    return type ? this.locale.text(type.nameEn, type.nameAr) : code;
  }

  rounds(): { round: number; tasks: WorkflowTask[] }[] {
    const groups = new Map<number, WorkflowTask[]>();
    for (const task of this.history()?.tasks ?? []) groups.set(task.round, [...(groups.get(task.round) ?? []), task]);
    return [...groups.entries()].sort(([a], [b]) => b - a).map(([round, tasks]) => ({ round, tasks: tasks.sort((a, b) => a.sequence - b.sequence) }));
  }

  outcomeLabel(value: string): string { return this.titleCase(value); }
  statusLabel(value: string): string { return this.titleCase(value); }
  formatDate(value: string | null | undefined): string {
    if (!value) return 'Not set';
    return new Intl.DateTimeFormat('en-SA', { dateStyle: 'medium' }).format(new Date(value.length === 10 ? `${value}T00:00:00` : value));
  }
  formatDateTime(value: string | null | undefined): string {
    if (!value) return 'Not set';
    return new Intl.DateTimeFormat('en-SA', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  }
  isReturnOutcome(): boolean { return this.outcome.startsWith('RETURN'); }

  private loadContext(task: WorkflowTask): Observable<ReviewContext> {
    const common = {
      task: of(task),
      options: this.api.taskOptions(task.id),
      history: this.api.workflowHistory(task.subjectType, task.subjectId),
      permitTypes: this.api.permitTypes(),
      externalCheck: task.adapterCode ? this.api.externalCheck(task.id) : of(null),
    };
    if (task.subjectType === 'EVENT') {
      return forkJoin({ ...common, event: this.api.event(task.subjectId), applications: this.api.eventApplications(task.subjectId) })
        .pipe(map((value) => ({ ...value, application: null, definition: null, answers: null })));
    }
    return this.api.application(task.subjectId).pipe(switchMap((application) => forkJoin({
      ...common,
      event: this.api.event(application.eventId),
      application: of(application),
      applications: of([] as PermitApplication[]),
      definition: this.api.form(application.permitTypeCode),
      answers: this.api.answers(application.id),
    })));
  }

  private loadLookups(fields: PermitField[]): void {
    const codes = [...new Set(fields.map((field) => field.lookupCode).filter((code): code is string => !!code))];
    if (!codes.length) { this.lookupValues.set({}); return; }
    forkJoin(Object.fromEntries(codes.map((code) => [code, this.api.lookup(code)])))
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (result) => this.lookupValues.set(Object.fromEntries(Object.entries(result).map(([code, lookup]) => [code, lookup.values]))),
      });
  }

  private lookupLabel(code: string | null, value: unknown): string {
    if (!code) return String(value);
    const match = (this.lookupValues()[code] ?? []).find((item) => String(item.id) === String(value) || item.code === String(value));
    return match ? this.locale.text(match.labelEn, match.labelAr) : String(value);
  }

  private refreshHistory(decided: WorkflowTask): void {
    this.api.workflowHistory(decided.subjectType, decided.subjectId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (history) => this.history.set(history),
    });
  }

  private titleCase(value: string): string {
    return value.split('_').map((part) => part.charAt(0) + part.slice(1).toLowerCase()).join(' ');
  }

  private fail(error: unknown): void {
    const response = error as HttpErrorResponse;
    const problem = response.error as ApiProblem | undefined;
    this.error.set(problem?.detail || response.message || 'The review task could not be loaded.');
    this.loading.set(false);
    this.working.set(false);
  }
}
