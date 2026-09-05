import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PermitsApiService } from '../../../core/api/permits-api.service';
import { Lookup, LookupValue } from '../../../shared/models/api.models';
import { adminErrorMessage } from '../admin-error';

type LookupTab = 'details' | 'values';

@Component({ selector: 'app-lookup-editor', imports: [FormsModule, RouterLink], template: `
  <header class="admin-page-header"><div><a class="admin-breadcrumb" routerLink="/admin/lookups">Lookups</a><p class="eyebrow">{{ isEdit ? 'EDIT LOOKUP' : 'NEW LOOKUP' }}</p>
    <h1>{{ isEdit ? (lookup()?.nameEn || code) : 'Create lookup' }}</h1><p>{{ isEdit ? code + ' · ' + (lookup()?.values?.length || 0) + ' values' : 'Create the lookup first, then add its values on the edit screen.' }}</p></div>
    <a class="admin-button secondary" routerLink="/admin/lookups">Back to list</a></header>
  @if (error()) { <div class="admin-alert error">{{ error() }}</div> } @if (message()) { <div class="admin-alert success">{{ message() }}</div> }
  @if (loading()) { <div class="admin-empty">Loading lookup…</div> } @else {
    @if (isEdit) { <nav class="admin-tabs"><button type="button" [class.active]="tab() === 'details'" (click)="tab.set('details')">Details</button><button type="button" [class.active]="tab() === 'values'" (click)="tab.set('values')">Values <span>{{ lookup()?.values?.length || 0 }}</span></button></nav> }
    @if (tab() === 'details') {
      <form class="admin-panel admin-form" (ngSubmit)="saveLookup()"><div class="admin-panel-heading"><div><h2>Lookup details</h2><p>Names and availability for this reusable value list.</p></div></div>
        <div class="admin-form-grid"><label><span>Code</span><input name="code" [(ngModel)]="form.code" [disabled]="isEdit" required placeholder="EVENT_CATEGORY"></label><span></span>
          <label><span>English name</span><input name="nameEn" [(ngModel)]="form.nameEn" required></label><label><span>Arabic name</span><input name="nameAr" [(ngModel)]="form.nameAr" required dir="rtl"></label></div>
        <div class="admin-check-row"><label><input type="checkbox" name="active" [(ngModel)]="form.active"> Active and available</label></div>
        <footer class="admin-form-actions"><a class="admin-button secondary" routerLink="/admin/lookups">Cancel</a><button class="admin-button primary" type="submit" [disabled]="saving()">{{ saving() ? 'Saving…' : (isEdit ? 'Save changes' : 'Create lookup') }}</button></footer>
      </form>
    }
    @if (isEdit && tab() === 'values') {
      <section class="admin-panel"><div class="admin-panel-heading"><div><h2>Lookup values</h2><p>Values are ordered by sort order, then code.</p></div><button class="admin-button primary" type="button" (click)="startNewValue()">Add value</button></div>
        @if (!lookup()?.values?.length) { <div class="admin-empty compact"><h3>No values yet</h3><p>Add the first selectable value.</p></div> }
        @else { <div class="admin-table-wrap flush"><table class="admin-table"><thead><tr><th>Value</th><th>Code</th><th>Order</th><th>Status</th><th></th></tr></thead><tbody>
          @for (value of lookup()!.values; track value.id) { <tr><td><strong>{{ value.labelEn }}</strong><small>{{ value.labelAr }}</small></td><td><code>{{ value.code }}</code></td><td>{{ value.sortOrder }}</td>
            <td><span class="admin-badge" [class.inactive]="!value.active">{{ value.active ? 'Active' : 'Inactive' }}</span></td><td class="admin-row-actions"><button class="admin-link-button" type="button" (click)="editValue(value)">Edit</button>@if (value.active) { <button class="admin-link-button danger" type="button" (click)="deactivateValue(value)">Deactivate</button> }</td></tr> }
        </tbody></table></div> }
      </section>
      @if (valueEditorOpen()) { <form class="admin-panel admin-form admin-subeditor" (ngSubmit)="saveValue()">
        <div class="admin-panel-heading"><div><p class="eyebrow">{{ editingValueId === null ? 'NEW VALUE' : 'EDIT VALUE' }}</p><h2>{{ editingValueId === null ? 'Value configuration' : valueForm.code }}</h2></div><button class="admin-close" type="button" (click)="closeValueEditor()">×</button></div>
        <div class="admin-form-grid"><label><span>Code</span><input name="valueCode" [(ngModel)]="valueForm.code" [disabled]="editingValueId !== null" required></label><label><span>Sort order</span><input name="sortOrder" type="number" [(ngModel)]="valueForm.sortOrder" required></label>
          <label><span>English label</span><input name="labelEn" [(ngModel)]="valueForm.labelEn" required></label><label><span>Arabic label</span><input name="labelAr" [(ngModel)]="valueForm.labelAr" required dir="rtl"></label></div>
        <div class="admin-check-row"><label><input type="checkbox" name="valueActive" [(ngModel)]="valueForm.active"> Active</label></div>
        <footer class="admin-form-actions"><button class="admin-button secondary" type="button" (click)="closeValueEditor()">Cancel</button><button class="admin-button primary" type="submit" [disabled]="saving()">{{ saving() ? 'Saving…' : (editingValueId === null ? 'Add value' : 'Update value') }}</button></footer>
      </form> }
    }
  }
` })
export class LookupEditorComponent {
  private readonly api = inject(PermitsApiService); private readonly route = inject(ActivatedRoute); private readonly router = inject(Router); private readonly destroyRef = inject(DestroyRef);
  readonly code = this.route.snapshot.paramMap.get('code') ?? ''; readonly isEdit = !!this.code;
  readonly lookup = signal<Lookup | null>(null); readonly tab = signal<LookupTab>('details'); readonly loading = signal(this.isEdit); readonly saving = signal(false);
  readonly error = signal(''); readonly message = signal(''); readonly valueEditorOpen = signal(false);
  editingValueId: number | null = null;
  form = { code: '', nameEn: '', nameAr: '', active: true };
  valueForm = this.emptyValue();
  constructor() { if (this.isEdit) this.reload(); }
  saveLookup(): void {
    this.beginSave(); const payload = { ...this.form, code: this.form.code.trim().toUpperCase() };
    const request = this.isEdit ? this.api.updateLookup(this.code, payload) : this.api.createLookup(payload);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (lookup) => { this.saving.set(false); if (!this.isEdit) this.router.navigate(['/admin/lookups', lookup.code, 'edit']); else { this.lookup.set(lookup); this.ok('Lookup details saved.'); } }, error: (error) => this.fail(error) });
  }
  startNewValue(): void { this.editingValueId = null; this.valueForm = this.emptyValue(); this.valueEditorOpen.set(true); this.clearNotices(); }
  editValue(value: LookupValue): void { this.editingValueId = value.id; this.valueForm = { code: value.code, labelEn: value.labelEn, labelAr: value.labelAr, sortOrder: value.sortOrder, active: value.active }; this.valueEditorOpen.set(true); this.clearNotices(); }
  closeValueEditor(): void { this.valueEditorOpen.set(false); this.editingValueId = null; }
  saveValue(): void {
    this.beginSave(); const editing = this.editingValueId !== null;
    const request = editing ? this.api.updateLookupValue(this.code, this.editingValueId!, { labelEn: this.valueForm.labelEn, labelAr: this.valueForm.labelAr, sortOrder: this.valueForm.sortOrder, active: this.valueForm.active }) : this.api.addLookupValue(this.code, { ...this.valueForm, code: this.valueForm.code.trim().toUpperCase() });
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (value) => { const current = this.lookup(); if (current) this.lookup.set({ ...current, values: editing ? current.values.map((item) => item.id === value.id ? value : item) : [...current.values, value] }); this.saving.set(false); this.closeValueEditor(); this.ok(editing ? 'Lookup value updated.' : 'Lookup value added.'); }, error: (error) => this.fail(error) });
  }
  deactivateValue(value: LookupValue): void { this.beginSave(); this.api.deactivateLookupValue(this.code, value.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (updated) => { const current = this.lookup(); if (current) this.lookup.set({ ...current, values: current.values.map((item) => item.id === updated.id ? updated : item) }); this.saving.set(false); this.ok('Lookup value deactivated.'); }, error: (error) => this.fail(error) }); }
  private reload(): void { this.api.adminLookups().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (lookups) => { const lookup = lookups.find((item) => item.code === this.code) ?? null; this.lookup.set(lookup); if (lookup) this.form = { code: lookup.code, nameEn: lookup.nameEn, nameAr: lookup.nameAr, active: lookup.active }; else this.error.set('Lookup not found.'); this.loading.set(false); }, error: (error) => this.fail(error) }); }
  private emptyValue() { return { code: '', labelEn: '', labelAr: '', sortOrder: 10, active: true }; }
  private beginSave(): void { this.saving.set(true); this.clearNotices(); } private clearNotices(): void { this.error.set(''); this.message.set(''); }
  private ok(message: string): void { this.error.set(''); this.message.set(message); } private fail(error: unknown): void { this.error.set(adminErrorMessage(error)); this.loading.set(false); this.saving.set(false); }
}
