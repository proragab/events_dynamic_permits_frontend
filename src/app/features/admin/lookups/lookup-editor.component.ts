import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PermitsApiService } from '../../../core/api/permits-api.service';
import { Lookup, LookupValue } from '../../../shared/models/api.models';
import { adminErrorMessage } from '../admin-error';

type LookupTab = 'details' | 'values';

@Component({ selector: 'app-lookup-editor', imports: [FormsModule, RouterLink], templateUrl: './lookup-editor.component.html' })
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
