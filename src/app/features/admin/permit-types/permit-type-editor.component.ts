import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin, of, switchMap } from 'rxjs';
import { PermitsApiService } from '../../../core/api/permits-api.service';
import { DataType, DefinitionPublication, Lookup, PermitField, PermitType, WorkflowDefinition } from '../../../shared/models/api.models';
import { LocaleService } from '../../../core/i18n/locale.service';
import { adminErrorMessage } from '../admin-error';

type PermitTab = 'details' | 'fields';

@Component({
  selector: 'app-permit-type-editor',
  imports: [FormsModule, RouterLink],
  styles: [`
    .draft-notice { display: flex; flex-wrap: wrap; gap: 1rem; align-items: center; margin-bottom: 1.5rem; color: var(--muted); }
    .service-settings { padding: 1.25rem; } summary { cursor: pointer; font-weight: 700; }
    .service-settings p { color: var(--muted); }
  `],
  templateUrl: './permit-type-editor.component.html',
})
export class PermitTypeEditorComponent {
  readonly locale = inject(LocaleService);
  private readonly api = inject(PermitsApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly code = this.route.snapshot.paramMap.get('code') ?? '';
  readonly isEdit = !!this.code;
  readonly tab = signal<PermitTab>(this.route.snapshot.queryParamMap.get('tab') === 'fields' ? 'fields' : 'details');
  readonly currentType = signal<PermitType | null>(null);
  readonly fields = signal<PermitField[]>([]);
  readonly lookups = signal<Lookup[]>([]);
  readonly workflows = signal<WorkflowDefinition[]>([]);
  readonly activeFields = signal<PermitField[]>([]);
  readonly publications = signal<DefinitionPublication[]>([]);
  private savedTypeForm = '';
  activeRevision(): number | null { return this.publications()[0]?.activeDefinitionRev ?? null; }
  private typeFormSnapshot(): string {
    return JSON.stringify({ nameEn: this.form.nameEn, nameAr: this.form.nameAr, category: this.form.category, workflowCode: this.form.workflowCode });
  }
  unsavedType(): boolean { return this.savedTypeForm !== this.typeFormSnapshot(); }
  activeField(field: PermitField): PermitField | undefined { return this.activeFields().find(f => f.fieldKey === field.fieldKey); }
  draftChanged(field: PermitField): boolean {
    const active = this.activeField(field);
    if (field.syncState === 'RETIRED') return !!active;
    return !active || JSON.stringify({ ...field, syncState: null }) !== JSON.stringify({ ...active, syncState: null });
  }
  draftStatus(field: PermitField): string {
    if (field.syncState === 'RETIRED') return this.activeField(field)
      ? this.locale.text('Remove on approval', 'إزالة عند الموافقة')
      : this.locale.text('Excluded from draft', 'مستبعد من المسودة');
    if (!this.activeField(field)) return this.locale.text('New', 'جديد');
    return this.draftChanged(field) ? this.locale.text('Edited', 'معدّل') : this.locale.text('Unchanged', 'دون تغيير');
  }
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly message = signal('');
  readonly fieldEditorOpen = signal(false);
  readonly dataTypes: DataType[] = ['TEXT', 'LONGTEXT', 'INTEGER', 'DECIMAL', 'MONEY', 'BOOLEAN', 'DATE', 'DATETIME', 'LOOKUP', 'MULTISELECT', 'FILE', 'SECTION'];
  editingFieldKey = '';
  form = { code: '', nameEn: '', nameAr: '', category: '', workflowCode: '', isDefault: false, active: true };
  fieldForm = this.emptyField();

  constructor() {
    if (this.isEdit) {
      forkJoin({ definition: this.api.adminPermitDefinition(this.code), lookups: this.api.adminLookups(), workflows: this.api.workflows(), publications: this.api.publications(this.code) })
        .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
          next: ({ definition, lookups, workflows, publications }) => {
            this.currentType.set(definition.type); this.fields.set(definition.fields); this.activeFields.set(definition.activeFields); this.lookups.set(lookups); this.workflows.set(workflows); this.publications.set(publications);
            this.form = { code: definition.type.code, nameEn: definition.type.nameEn, nameAr: definition.type.nameAr, category: definition.type.category ?? '', workflowCode: definition.type.workflowCode ?? '', isDefault: definition.type.defaultType, active: definition.type.active };
            this.savedTypeForm = this.typeFormSnapshot();
            this.loading.set(false);
          }, error: (error) => this.fail(error),
        });
    } else {
      forkJoin({ lookups: this.api.adminLookups(), workflows: this.api.workflows() }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: ({ lookups, workflows }) => { this.lookups.set(lookups); this.workflows.set(workflows); this.loading.set(false); }, error: (error) => this.fail(error),
      });
    }
  }

  saveDefinition(submit: boolean): void {
    if (this.saving() || this.fieldEditorOpen()) return;
    if (!this.form.nameEn.trim() || !this.form.nameAr.trim() || (!this.isEdit && !this.form.code.trim())) {
      this.error.set(this.locale.text('Enter the permit code and both names before continuing.', 'أدخل رمز التصريح والاسمين قبل المتابعة.')); this.tab.set('details'); return;
    }
    this.beginSave();
    const current = this.currentType();
    const payload = { ...this.form, code: this.form.code.trim().toUpperCase(), category: this.form.category || null, workflowCode: this.form.workflowCode || null,
      isDefault: current?.defaultType ?? false, active: current?.active ?? true };
    if (!this.isEdit) {
      this.api.createPermitType(payload).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: type => { this.saving.set(false); this.router.navigate(['/admin/permit-types', type.code, 'edit'], { queryParams: { tab: 'fields' } }); }, error: error => this.fail(error),
      }); return;
    }
    if (submit && !current?.active) { this.fail({ error: { detail: this.locale.text('Enable the service in Service settings before sending this draft for review.', 'فعّل الخدمة من إعدادات الخدمة قبل إرسال المسودة للمراجعة.') } }); return; }
    if (!current) { this.saving.set(false); return; }
    if (this.form.active !== current.active || this.form.isDefault !== current.defaultType) {
      this.fail({ error: { detail: this.locale.text('Apply or undo the changes in Service settings before continuing.', 'طبّق تغييرات إعدادات الخدمة أو تراجع عنها قبل المتابعة.') } }); return;
    }
    const previous = this.publications().find(p => !p.baseline && p.draftRev === current.catalogRev);
    const needsRebase = submit && (previous?.publicationState === 'REJECTED' || (previous?.publicationState === 'SCHEMA_PENDING' && previous.baseActiveDefinitionRev !== previous.activeDefinitionRev));
    const save = this.unsavedType() || needsRebase ? this.api.updatePermitType(this.code, payload, current.catalogRev) : of(current);
    save.pipe(switchMap(type => {
      this.currentType.set(type); this.savedTypeForm = this.typeFormSnapshot();
      if (!submit) return of(null);
      const existing = this.publications().find(p => !p.baseline && p.draftRev === type.catalogRev);
      return existing ? of(existing) : this.api.publishDefinition(this.code, type.catalogRev, 'REVIEW');
    }), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: p => { this.saving.set(false); if (p) this.router.navigate(['/admin/definition-reviews'], { queryParams: { type: this.code } }); else this.ok(this.locale.text('Draft saved. Submit for review when ready. The published version is unchanged.', 'تم حفظ المسودة. أرسلها للمراجعة عند الجاهزية. لم يتغير الإصدار المنشور.')); },
      error: error => this.fail(error),
    });
  }
  saveSettings(): void {
    const current = this.currentType(); if (!current || this.saving()) return;
    this.beginSave();
    this.api.updatePermitType(this.code, { nameEn: current.nameEn, nameAr: current.nameAr, category: current.category, workflowCode: current.workflowCode,
      isDefault: this.form.isDefault, active: this.form.active }, current.catalogRev).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: type => { this.currentType.set(type); this.saving.set(false); this.ok(this.locale.text('Service settings applied.', 'تم تطبيق إعدادات الخدمة.')); }, error: error => this.fail(error),
    });
  }
  startNewField(): void { this.editingFieldKey = ''; this.fieldForm = this.emptyField(); this.fieldEditorOpen.set(true); this.clearNotices(); }
  editField(field: PermitField): void {
    this.editingFieldKey = field.fieldKey;
    this.fieldForm = { fieldKey: field.fieldKey, dataType: field.dataType, length: field.length, precision: field.precision, scale: field.scale, required: field.required, requiredWhen: field.requiredWhen ?? '', defaultValue: field.defaultValue ?? '', lookupCode: field.lookupCode ?? '', labelEn: field.labelEn, labelAr: field.labelAr, helpEn: field.helpEn ?? '', helpAr: field.helpAr ?? '', sectionCode: field.sectionCode ?? '', sortOrder: field.sortOrder, ruleMin: field.ruleMin, ruleMax: field.ruleMax, rulePattern: field.rulePattern ?? '' };
    this.fieldEditorOpen.set(true); this.clearNotices();
  }
  closeFieldEditor(): void { this.fieldEditorOpen.set(false); this.editingFieldKey = ''; }
  saveField(): void {
    this.beginSave();
    const payload = { ...this.fieldForm, length: this.fieldForm.dataType === 'TEXT' ? this.fieldForm.length : null, precision: ['DECIMAL', 'MONEY'].includes(this.fieldForm.dataType) ? this.fieldForm.precision : null, scale: ['DECIMAL', 'MONEY'].includes(this.fieldForm.dataType) ? this.fieldForm.scale : null, defaultValue: this.fieldForm.defaultValue || null, lookupCode: this.fieldForm.lookupCode || null, requiredWhen: this.fieldForm.requiredWhen || null, helpEn: this.fieldForm.helpEn || null, helpAr: this.fieldForm.helpAr || null, sectionCode: this.fieldForm.sectionCode || null, rulePattern: this.fieldForm.rulePattern || null };
    const request = this.editingFieldKey ? this.api.updatePermitField(this.code, this.editingFieldKey, payload, this.currentType()!.catalogRev) : this.api.addPermitField(this.code, payload, this.currentType()!.catalogRev);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (field) => {
      this.fields.update((items) => this.editingFieldKey ? items.map((item) => item.fieldKey === field.fieldKey ? field : item) : [...items, field]);
      this.closeFieldEditor(); this.reloadDefinition(); this.ok(this.locale.text('Field saved in draft. No version has been published.', 'تم حفظ الحقل في المسودة. لم يتم نشر أي إصدار.'));
    }, error: (error) => this.fail(error) });
  }
  retireField(field: PermitField): void {
    this.beginSave();
    this.api.retirePermitField(this.code, field.fieldKey, this.currentType()!.catalogRev).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => { this.reloadDefinition(); this.ok(this.locale.text('Retirement saved in draft.', 'تم حفظ إيقاف الحقل في المسودة.')); }, error: error => this.fail(error),
    });
  }
  restoreField(field: PermitField): void {
    this.beginSave();
    this.api.restorePermitField(this.code, field.fieldKey, this.currentType()!.catalogRev).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => { this.reloadDefinition(); this.ok(this.locale.text('Removal undone in draft.', 'تم التراجع عن الإزالة في المسودة.')); }, error: error => this.fail(error),
    });
  }
  private reloadDefinition(): void {
    forkJoin({ definition: this.api.adminPermitDefinition(this.code), publications: this.api.publications(this.code) })
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: ({ definition, publications }) => { this.currentType.set(definition.type); this.fields.set(definition.fields); this.activeFields.set(definition.activeFields); this.publications.set(publications); this.saving.set(false); },
        error: error => this.fail(error),
      });
  }
  private emptyField() { return { fieldKey: '', dataType: 'TEXT' as DataType, length: 160 as number | null, precision: null as number | null, scale: null as number | null, required: false, requiredWhen: '', defaultValue: '', lookupCode: '', labelEn: '', labelAr: '', helpEn: '', helpAr: '', sectionCode: '', sortOrder: 10, ruleMin: null as number | null, ruleMax: null as number | null, rulePattern: '' }; }
  private beginSave(): void { this.saving.set(true); this.clearNotices(); }
  private clearNotices(): void { this.error.set(''); this.message.set(''); }
  private ok(message: string): void { this.error.set(''); this.message.set(message); }
  private fail(error: unknown): void { this.error.set(adminErrorMessage(error)); this.saving.set(false); this.loading.set(false); }
}
