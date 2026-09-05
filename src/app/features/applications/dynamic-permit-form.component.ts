import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule, UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin, switchMap } from 'rxjs';
import { PermitsApiService } from '../../core/api/permits-api.service';
import { LocaleService } from '../../core/i18n/locale.service';
import { ApiProblem, FileAnswer, LookupValue, PermitApplication, PermitField, PermitForm } from '../../shared/models/api.models';

@Component({
  selector: 'app-dynamic-permit-form',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './dynamic-permit-form.component.html',
  styleUrl: './dynamic-permit-form.component.scss'
})
export class DynamicPermitFormComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(PermitsApiService);
  private readonly builder = inject(UntypedFormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  readonly locale = inject(LocaleService);

  readonly application = signal<PermitApplication | null>(null);
  readonly definition = signal<PermitForm | null>(null);
  readonly lookups = signal<Record<string, LookupValue[]>>({});
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly message = signal('');
  readonly error = signal('');
  form: UntypedFormGroup = this.builder.group({});

  constructor() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.api.application(id).pipe(
      switchMap(application => {
        this.application.set(application);
        return forkJoin({ definition: this.api.form(application.permitTypeCode), answers: this.api.answers(id) });
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: ({ definition, answers }) => {
        this.definition.set(definition);
        this.buildForm(definition, answers.answers);
        this.loadLookups(definition.fields);
        this.loading.set(false);
      },
      error: error => this.fail(error)
    });
  }

  fields(): PermitField[] { return [...(this.definition()?.fields ?? [])].sort((a, b) => a.sortOrder - b.sortOrder); }
  label(field: PermitField): string { return this.locale.text(field.labelEn, field.labelAr); }
  help(field: PermitField): string { return this.locale.text(field.helpEn, field.helpAr); }
  values(field: PermitField): LookupValue[] { return field.lookupCode ? this.lookups()[field.lookupCode] ?? [] : []; }
  valueLabel(value: LookupValue): string { return this.locale.text(value.labelEn, value.labelAr); }

  save(): void {
    if (this.form.invalid || !this.application()) { this.form.markAllAsTouched(); return; }
    this.saving.set(true); this.error.set(''); this.message.set('');
    this.api.patchAnswers(this.application()!.id, this.form.getRawValue()).pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: response => { this.form.patchValue(response.answers); this.saving.set(false); this.message.set(this.locale.locale() === 'ar' ? 'تم حفظ البيانات' : 'Answers saved'); },
        error: error => this.fail(error)
      });
  }

  submit(): void {
    if (this.form.invalid || !this.application()) { this.form.markAllAsTouched(); return; }
    this.saving.set(true); this.error.set('');
    this.api.patchAnswers(this.application()!.id, this.form.getRawValue()).pipe(
      switchMap(() => this.application()!.status === 'RETURNED_TO_APPLICANT'
        ? this.api.resubmitApplication(this.application()!.id) : this.api.submitApplication(this.application()!.id)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: () => { this.saving.set(false); this.message.set(this.locale.locale() === 'ar' ? 'تم تقديم الطلب' : 'Application submitted'); },
      error: error => this.fail(error)
    });
  }

  selectFile(field: PermitField, event: Event): void {
    const input = event.target as HTMLInputElement;
    const files: FileAnswer[] = Array.from(input.files ?? []).map(file => ({
      fileRef: `local://${crypto.randomUUID()}/${encodeURIComponent(file.name)}`,
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
      status: 'ACTIVE',
      uploadedBy: 'browser-session'
    }));
    this.form.get(field.fieldKey)?.setValue(files);
    this.form.get(field.fieldKey)?.markAsDirty();
  }

  files(field: PermitField): FileAnswer[] { return (this.form.get(field.fieldKey)?.value as FileAnswer[] | null) ?? []; }
  invalid(field: PermitField): boolean {
    const control = this.form.get(field.fieldKey);
    return !!control && control.invalid && (control.dirty || control.touched);
  }
  readonlyMode(): boolean { return !['DRAFT', 'RETURNED_TO_APPLICANT'].includes(this.application()?.status ?? ''); }

  private buildForm(definition: PermitForm, answers: Record<string, unknown>): void {
    const controls: Record<string, unknown[]> = {};
    for (const field of definition.fields) {
      if (field.dataType === 'SECTION') continue;
      const rules = [];
      if (field.required && !field.requiredWhen) rules.push(Validators.required);
      if (field.length) rules.push(Validators.maxLength(field.length));
      if (field.ruleMin !== null) rules.push(Validators.min(field.ruleMin));
      if (field.ruleMax !== null) rules.push(Validators.max(field.ruleMax));
      if (field.rulePattern) rules.push(Validators.pattern(field.rulePattern));
      const fallback = field.dataType === 'BOOLEAN' ? false : ['MULTISELECT', 'FILE'].includes(field.dataType) ? [] : null;
      controls[field.fieldKey] = [answers[field.fieldKey] ?? fallback, rules];
    }
    this.form = this.builder.group(controls);
    if (this.readonlyMode()) this.form.disable();
  }

  private loadLookups(fields: PermitField[]): void {
    const codes = [...new Set(fields.map(field => field.lookupCode).filter((code): code is string => !!code))];
    if (!codes.length) return;
    forkJoin(Object.fromEntries(codes.map(code => [code, this.api.lookup(code)]))).pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(result => this.lookups.set(Object.fromEntries(Object.entries(result)
        .map(([code, lookup]) => [code, lookup.values.filter(value => value.active)]))));
  }

  private fail(error: unknown): void {
    const response = error as HttpErrorResponse;
    const problem = response.error as ApiProblem | undefined;
    this.error.set(problem?.detail || response.message || 'Request failed');
    this.loading.set(false); this.saving.set(false);
  }
}
