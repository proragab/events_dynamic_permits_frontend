import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { PermitsApiService } from '../../../core/api/permits-api.service';
import { DataType, Lookup, PermitField, PermitType, SchemaPlan, WorkflowDefinition } from '../../../shared/models/api.models';
import { adminErrorMessage } from '../admin-error';

type PermitTab = 'details' | 'fields' | 'schema';

@Component({
  selector: 'app-permit-type-editor',
  imports: [FormsModule, RouterLink],
  template: `
    <header class="admin-page-header">
      <div><a class="admin-breadcrumb" routerLink="/admin/permit-types">Permit Types</a><p class="eyebrow">{{ isEdit ? 'EDIT DEFINITION' : 'NEW DEFINITION' }}</p>
        <h1>{{ isEdit ? (currentType()?.nameEn || code) : 'Create permit type' }}</h1>
        <p>{{ isEdit ? code + ' · Catalog revision ' + (currentType()?.catalogRev || 0) : 'Start with the permit identity. Fields and schema become available after creation.' }}</p></div>
      <a class="admin-button secondary" routerLink="/admin/permit-types">Back to list</a>
    </header>
    @if (error()) { <div class="admin-alert error">{{ error() }}</div> }
    @if (message()) { <div class="admin-alert success">{{ message() }}</div> }
    @if (loading()) { <div class="admin-empty">Loading permit definition…</div> }
    @else {
      @if (isEdit) {
        <nav class="admin-tabs" aria-label="Permit type editor">
          <button type="button" [class.active]="tab() === 'details'" (click)="tab.set('details')">Details</button>
          <button type="button" [class.active]="tab() === 'fields'" (click)="tab.set('fields')">Fields <span>{{ fields().length }}</span></button>
          <button type="button" [class.active]="tab() === 'schema'" (click)="tab.set('schema')">Schema</button>
        </nav>
      }

      @if (tab() === 'details') {
        <form class="admin-panel admin-form" (ngSubmit)="saveType()">
          <div class="admin-panel-heading"><div><h2>Permit details</h2><p>Basic identity and workflow assignment.</p></div></div>
          <div class="admin-form-grid">
            <label><span>Code</span><input name="code" [(ngModel)]="form.code" [disabled]="isEdit" required placeholder="EVENT_PERMIT"></label>
            <label><span>Category</span><input name="category" [(ngModel)]="form.category" placeholder="EVENTS"></label>
            <label><span>English name</span><input name="nameEn" [(ngModel)]="form.nameEn" required></label>
            <label><span>Arabic name</span><input name="nameAr" [(ngModel)]="form.nameAr" required dir="rtl"></label>
            <label class="wide"><span>Workflow</span><select name="workflowCode" [(ngModel)]="form.workflowCode"><option value="">No workflow assigned</option>
              @for (workflow of workflows(); track workflow.code) { <option [value]="workflow.code">{{ workflow.nameEn }} ({{ workflow.code }})</option> }
            </select><small>Choose the process that handles applications of this type.</small></label>
          </div>
          <div class="admin-check-row"><label><input type="checkbox" name="isDefault" [(ngModel)]="form.isDefault"> Default permit type</label>
            <label><input type="checkbox" name="active" [(ngModel)]="form.active"> Active and available</label></div>
          <footer class="admin-form-actions"><a class="admin-button secondary" routerLink="/admin/permit-types">Cancel</a><button class="admin-button primary" type="submit" [disabled]="saving()">{{ saving() ? 'Saving…' : (isEdit ? 'Save changes' : 'Create permit type') }}</button></footer>
        </form>
      }

      @if (isEdit && tab() === 'fields') {
        <section class="admin-panel">
          <div class="admin-panel-heading"><div><h2>Form fields</h2><p>Each field maps to the physical permit table after schema synchronization.</p></div>
            <button class="admin-button primary" type="button" (click)="startNewField()">Add field</button></div>
          @if (!fields().length) { <div class="admin-empty compact"><h3>No fields yet</h3><p>Add the first field for this permit form.</p></div> }
          @else { <div class="admin-table-wrap flush"><table class="admin-table"><thead><tr><th>Field</th><th>Type</th><th>Required</th><th>Order</th><th>Schema</th><th></th></tr></thead>
            <tbody>@for (field of fields(); track field.fieldKey) { <tr><td><strong>{{ field.labelEn }}</strong><small><code>{{ field.fieldKey }}</code> · {{ field.labelAr }}</small></td>
              <td>{{ field.dataType }}@if (field.lookupCode) { <small>{{ field.lookupCode }}</small> }</td><td>{{ field.required ? 'Yes' : 'No' }}</td><td>{{ field.sortOrder }}</td>
              <td><span class="admin-badge" [class.pending]="field.syncState === 'PENDING'" [class.inactive]="field.syncState === 'RETIRED'">{{ field.syncState }}</span></td>
              <td class="admin-row-actions"><button class="admin-link-button" type="button" (click)="editField(field)">Edit</button>@if (field.syncState !== 'RETIRED') { <button class="admin-link-button danger" type="button" (click)="retireField(field)">Retire</button> }</td></tr> }</tbody></table></div> }
        </section>

        @if (fieldEditorOpen()) {
          <form class="admin-panel admin-form admin-subeditor" (ngSubmit)="saveField()">
            <div class="admin-panel-heading"><div><p class="eyebrow">{{ editingFieldKey ? 'EDIT FIELD' : 'NEW FIELD' }}</p><h2>{{ editingFieldKey || 'Field configuration' }}</h2></div><button class="admin-close" type="button" (click)="closeFieldEditor()" aria-label="Close">×</button></div>
            <div class="admin-form-grid three">
              <label><span>Field key</span><input name="fieldKey" [(ngModel)]="fieldForm.fieldKey" [disabled]="!!editingFieldKey" required placeholder="venue_capacity"></label>
              <label><span>Data type</span><select name="dataType" [(ngModel)]="fieldForm.dataType">@for (type of dataTypes; track type) { <option [value]="type">{{ type }}</option> }</select></label>
              <label><span>Sort order</span><input name="sortOrder" type="number" [(ngModel)]="fieldForm.sortOrder" required></label>
              <label><span>English label</span><input name="labelEn" [(ngModel)]="fieldForm.labelEn" required></label>
              <label><span>Arabic label</span><input name="labelAr" [(ngModel)]="fieldForm.labelAr" required dir="rtl"></label>
              <label><span>Section</span><input name="sectionCode" [(ngModel)]="fieldForm.sectionCode" placeholder="DETAILS"></label>
              @if (fieldForm.dataType === 'TEXT') { <label><span>Maximum length</span><input name="length" type="number" [(ngModel)]="fieldForm.length"></label> }
              @if (fieldForm.dataType === 'DECIMAL' || fieldForm.dataType === 'MONEY') {
                <label><span>Precision</span><input name="precision" type="number" [(ngModel)]="fieldForm.precision"></label>
                <label><span>Scale</span><input name="scale" type="number" [(ngModel)]="fieldForm.scale"></label>
              }
              @if (fieldForm.dataType === 'LOOKUP' || fieldForm.dataType === 'MULTISELECT') {
                <label><span>Lookup</span><select name="lookupCode" [(ngModel)]="fieldForm.lookupCode" required><option value="">Select lookup</option>@for (lookup of lookups(); track lookup.code) { <option [value]="lookup.code">{{ lookup.nameEn }}</option> }</select></label>
              }
              <label><span>Default value</span><input name="defaultValue" [(ngModel)]="fieldForm.defaultValue"></label>
              <label><span>Required when</span><input name="requiredWhen" [(ngModel)]="fieldForm.requiredWhen" placeholder="Optional rule code"></label>
              <label><span>Minimum</span><input name="ruleMin" type="number" [(ngModel)]="fieldForm.ruleMin"></label>
              <label><span>Maximum</span><input name="ruleMax" type="number" [(ngModel)]="fieldForm.ruleMax"></label>
              <label><span>Validation pattern</span><input name="rulePattern" [(ngModel)]="fieldForm.rulePattern"></label>
              <label class="wide"><span>English help</span><textarea name="helpEn" [(ngModel)]="fieldForm.helpEn" rows="2"></textarea></label>
              <label class="wide"><span>Arabic help</span><textarea name="helpAr" [(ngModel)]="fieldForm.helpAr" rows="2" dir="rtl"></textarea></label>
            </div>
            <div class="admin-check-row"><label><input type="checkbox" name="required" [(ngModel)]="fieldForm.required"> Required field</label></div>
            <footer class="admin-form-actions"><button class="admin-button secondary" type="button" (click)="closeFieldEditor()">Cancel</button><button class="admin-button primary" type="submit" [disabled]="saving()">{{ saving() ? 'Saving…' : (editingFieldKey ? 'Update field' : 'Add field') }}</button></footer>
          </form>
        }
      }

      @if (isEdit && tab() === 'schema') {
        <section class="admin-panel">
          <div class="admin-panel-heading"><div><h2>Physical schema</h2><p>Review field-to-column changes before applying them to {{ currentType()?.tableName }}.</p></div><div class="admin-heading-actions"><a class="admin-button secondary" [routerLink]="['/admin/change-history']" [queryParams]="{ permitType: code }">View history</a><button class="admin-button secondary" type="button" (click)="loadPlan()">Refresh plan</button></div></div>
          @if (!plan()) { <div class="admin-empty compact">Loading schema plan…</div> }
          @else if (plan()!.conformant) { <div class="admin-state-good"><strong>Schema is synchronized</strong><span>No physical table changes are pending.</span></div> }
          @else {
            <div class="admin-summary-row"><span><strong>{{ plan()!.operations.length }}</strong> pending operations</span><span><strong>{{ plan()!.rowEstimate }}</strong> estimated rows</span><span><strong>{{ plan()!.orphanColumns.length }}</strong> orphan columns</span></div>
            <div class="admin-operation-list">@for (operation of plan()!.operations; track $index) { <article><span class="admin-badge pending">{{ operation.type }}</span><div><strong>{{ operation.target }}</strong><p>{{ operation.reason }}</p></div><small>{{ operation.lockRisk }} lock risk</small></article> }</div>
            <footer class="admin-form-actions"><button class="admin-button secondary" type="button" (click)="sync('REVIEW')" [disabled]="saving()">Stage for approval</button><button class="admin-button primary" type="button" (click)="sync('AUTO')" [disabled]="saving()">Apply automatically</button><button class="admin-button primary" type="button" (click)="approve()" [disabled]="saving()">Approve staged plan</button></footer>
          }
        </section>
      }
    }
  `,
})
export class PermitTypeEditorComponent {
  private readonly api = inject(PermitsApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly code = this.route.snapshot.paramMap.get('code') ?? '';
  readonly isEdit = !!this.code;
  readonly tab = signal<PermitTab>('details');
  readonly currentType = signal<PermitType | null>(null);
  readonly fields = signal<PermitField[]>([]);
  readonly lookups = signal<Lookup[]>([]);
  readonly workflows = signal<WorkflowDefinition[]>([]);
  readonly plan = signal<SchemaPlan | null>(null);
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
      forkJoin({ definition: this.api.adminPermitDefinition(this.code), lookups: this.api.adminLookups(), workflows: this.api.workflows(), plan: this.api.schemaPlan(this.code) })
        .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
          next: ({ definition, lookups, workflows, plan }) => {
            this.currentType.set(definition.type); this.fields.set(definition.fields); this.lookups.set(lookups); this.workflows.set(workflows); this.plan.set(plan);
            this.form = { code: definition.type.code, nameEn: definition.type.nameEn, nameAr: definition.type.nameAr, category: definition.type.category ?? '', workflowCode: definition.type.workflowCode ?? '', isDefault: definition.type.defaultType, active: definition.type.active };
            this.loading.set(false);
          }, error: (error) => this.fail(error),
        });
    } else {
      forkJoin({ lookups: this.api.adminLookups(), workflows: this.api.workflows() }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: ({ lookups, workflows }) => { this.lookups.set(lookups); this.workflows.set(workflows); this.loading.set(false); }, error: (error) => this.fail(error),
      });
    }
  }

  saveType(): void {
    this.beginSave();
    const payload = { ...this.form, code: this.form.code.trim().toUpperCase(), category: this.form.category || null, workflowCode: this.form.workflowCode || null };
    const request = this.isEdit ? this.api.updatePermitType(this.code, payload) : this.api.createPermitType(payload);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (type) => { this.saving.set(false); if (!this.isEdit) this.router.navigate(['/admin/permit-types', type.code, 'edit']); else { this.currentType.set(type); this.ok('Permit type details saved.'); } },
      error: (error) => this.fail(error),
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
    const editing = !!this.editingFieldKey;
    const payload = { ...this.fieldForm, length: this.fieldForm.dataType === 'TEXT' ? this.fieldForm.length : null, precision: ['DECIMAL', 'MONEY'].includes(this.fieldForm.dataType) ? this.fieldForm.precision : null, scale: ['DECIMAL', 'MONEY'].includes(this.fieldForm.dataType) ? this.fieldForm.scale : null, defaultValue: this.fieldForm.defaultValue || null, lookupCode: this.fieldForm.lookupCode || null, requiredWhen: this.fieldForm.requiredWhen || null, helpEn: this.fieldForm.helpEn || null, helpAr: this.fieldForm.helpAr || null, sectionCode: this.fieldForm.sectionCode || null, rulePattern: this.fieldForm.rulePattern || null };
    const request = this.editingFieldKey ? this.api.updatePermitField(this.code, this.editingFieldKey, payload) : this.api.addPermitField(this.code, payload);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (field) => {
      this.fields.update((items) => this.editingFieldKey ? items.map((item) => item.fieldKey === field.fieldKey ? field : item) : [...items, field]);
      this.saving.set(false); this.closeFieldEditor(); this.loadPlan(); this.ok(editing ? 'Field updated.' : 'Field added. Review the schema plan before applying.');
    }, error: (error) => this.fail(error) });
  }
  retireField(field: PermitField): void { this.beginSave(); this.api.retirePermitField(this.code, field.fieldKey).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (updated) => { this.fields.update((items) => items.map((item) => item.fieldKey === updated.fieldKey ? updated : item)); this.saving.set(false); this.loadPlan(); this.ok('Field retired.'); }, error: (error) => this.fail(error) }); }
  loadPlan(): void { this.api.schemaPlan(this.code).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (plan) => this.plan.set(plan), error: (error) => this.fail(error) }); }
  sync(mode: 'REVIEW' | 'AUTO'): void { this.beginSave(); this.api.syncSchema(this.code, mode).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: () => { this.saving.set(false); this.reloadDefinition(); this.loadPlan(); this.ok(mode === 'REVIEW' ? 'Schema plan staged for approval.' : 'Schema synchronized.'); }, error: (error) => this.fail(error) }); }
  approve(): void { this.beginSave(); this.api.approveSchema(this.code).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: () => { this.saving.set(false); this.reloadDefinition(); this.loadPlan(); this.ok('Staged schema plan approved and applied.'); }, error: (error) => this.fail(error) }); }
  private reloadDefinition(): void { this.api.adminPermitDefinition(this.code).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (definition) => { this.currentType.set(definition.type); this.fields.set(definition.fields); }, error: (error) => this.fail(error) }); }
  private emptyField() { return { fieldKey: '', dataType: 'TEXT' as DataType, length: 160 as number | null, precision: null as number | null, scale: null as number | null, required: false, requiredWhen: '', defaultValue: '', lookupCode: '', labelEn: '', labelAr: '', helpEn: '', helpAr: '', sectionCode: '', sortOrder: 10, ruleMin: null as number | null, ruleMax: null as number | null, rulePattern: '' }; }
  private beginSave(): void { this.saving.set(true); this.clearNotices(); }
  private clearNotices(): void { this.error.set(''); this.message.set(''); }
  private ok(message: string): void { this.error.set(''); this.message.set(message); }
  private fail(error: unknown): void { this.error.set(adminErrorMessage(error)); this.saving.set(false); this.loading.set(false); }
}
