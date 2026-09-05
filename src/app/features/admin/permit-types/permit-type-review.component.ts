import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Observable, forkJoin } from 'rxjs';
import { PermitsApiService } from '../../../core/api/permits-api.service';
import { LocaleService } from '../../../core/i18n/locale.service';
import { AdminPermitForm, DefinitionPublication } from '../../../shared/models/api.models';
import { adminErrorMessage } from '../admin-error';
import { definitionChanges } from './publication-review';

@Component({
  selector: 'app-permit-type-review',
  imports: [RouterLink, FormsModule, DatePipe],
  styles: [`
    .review-intro, .review-actions, .review-details, .review-success { padding: 1.4rem; }
    .review-intro p, .review-actions p { color: var(--muted); margin: .6rem 0 0; }
    .review-step { display: flex; gap: .75rem; align-items: center; margin-bottom: 1rem; color: var(--muted); }
    .review-step a { color: inherit; } .review-step strong { color: var(--ink); }
    .change-list { display: grid; gap: 1rem; }
    .change-heading { display: flex; gap: .8rem; align-items: center; flex-wrap: wrap; padding: 1.1rem 1.4rem; border-bottom: 1px solid var(--border); }
    .change-heading h3 { margin: 0; } .change-heading small { color: var(--muted); }
    .change-list .admin-panel { margin: 0; }
    .admin-table { table-layout: fixed; } .admin-table th:first-child { width: 25%; }
    .admin-table td { white-space: pre-wrap; overflow-wrap: anywhere; vertical-align: top; }
    .before { color: var(--muted); } .after { background: #f3f9f6; }
    .review-actions { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-top: 1.5rem; }
    .review-actions > div { display: flex; flex-wrap: wrap; gap: .8rem; }
    .review-details { margin-top: 1rem; box-shadow: none; }
    summary { cursor: pointer; font-weight: 700; } .review-details p { color: var(--muted); }
    pre, code { white-space: pre-wrap; overflow-wrap: anywhere; }
    .sql-operation { padding: 1rem 0; border-bottom: 1px solid var(--border); }
    .history-row { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 1rem; padding: 1rem 0; border-bottom: 1px solid var(--border); }
    .review-success h2 { margin-top: 0; }
    @media (max-width: 680px) { .review-actions { align-items: stretch; flex-direction: column; } .admin-table { min-width: 520px; } }
  `],
  templateUrl: './permit-type-review.component.html',
})
export class PermitTypeReviewComponent {
  readonly locale = inject(LocaleService);
  private readonly api = inject(PermitsApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  code = '';
  private id = 0;
  private loadSequence = 0;
  readonly publication = signal<DefinitionPublication | null>(null);
  readonly draft = signal<AdminPermitForm | null>(null);
  readonly rejectOpen = signal(false);
  rejectionReason = '';
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly changes = computed(() => {
    const p = this.publication(); return p ? definitionChanges(p.baseDefinition, p.definition, this.locale.text('Permit details', 'تفاصيل التصريح')) : [];
  });
  isCurrent(): boolean { const p = this.publication(); return !!p && p.definitionRev === p.activeDefinitionRev; }
  blockReason(): string {
    const p = this.publication(); const d = this.draft(); if (!p || !d) return '';
    if (p.baseActiveDefinitionRev !== p.activeDefinitionRev) return this.locale.text('The published definition changed since this review was prepared. Return to edit and prepare a new review.', 'تغير التعريف المنشور منذ تجهيز المراجعة. عد للتعديل وجهّز مراجعة جديدة.');
    if (!d.type.active) return this.locale.text('Enable the service in the editor’s Service settings before publishing.', 'فعّل الخدمة من إعدادات الخدمة في المحرر قبل النشر.');
    if (p.nextAction === 'EDIT_DRAFT') return this.locale.text('This draft needs a correction before it can be published. Return to edit and resolve the issue below.', 'تحتاج المسودة إلى تصحيح قبل النشر. عد للتعديل وعالج المشكلة أدناه.');
    return '';
  }
  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      this.code = params.get('code') ?? ''; this.id = Number(params.get('publicationId')); this.error.set(''); this.rejectOpen.set(false); this.rejectionReason = ''; this.load();
    });
  }
  load(): void {
    const sequence = ++this.loadSequence;
    this.loading.set(true);
    forkJoin({ publication: this.api.publication(this.code, this.id), draft: this.api.adminPermitDefinition(this.code) })
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: result => { if (sequence !== this.loadSequence) return; this.publication.set(result.publication); this.draft.set(result.draft); this.loading.set(false); },
        error: error => { if (sequence !== this.loadSequence) return; this.error.set(adminErrorMessage(error)); this.loading.set(false); this.publication.set(null); },
      });
  }
  validate(): void {
    const p = this.publication(); if (!p || this.busy() || this.blockReason() || p.publicationState !== 'SCHEMA_PENDING') return;
    this.runAction(this.api.validatePublication(this.code, p));
  }
  approve(): void {
    const p = this.publication(); if (!p || this.busy() || this.blockReason() || p.publicationState !== 'SCHEMA_PENDING' || p.validationStatus !== 'PASSED') return;
    this.runAction(this.api.applyPublication(this.code, p, true));
  }
  reject(): void {
    const p = this.publication(); if (!p || this.busy() || p.publicationState !== 'SCHEMA_PENDING' || !this.rejectionReason.trim()) return;
    this.runAction(this.api.rejectPublication(this.code, p, this.rejectionReason.trim()));
  }
  private runAction(request: Observable<DefinitionPublication>): void {
    const id = this.id; const code = this.code;
    this.busy.set(true); this.error.set('');
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: result => { this.busy.set(false); if (this.id !== id || this.code !== code) return; this.publication.set(result); if (result.publicationState === 'REJECTED') this.rejectOpen.set(false); },
      error: error => { this.busy.set(false); if (this.id !== id || this.code !== code) return; this.error.set(adminErrorMessage(error)); this.load(); },
    });
  }
  kindLabel(kind: string): string { return kind === 'added' ? this.locale.text('Added', 'مضاف') : kind === 'retired' ? this.locale.text('Removed', 'مزال') : this.locale.text('Changed', 'معدّل'); }
  display(value: unknown): string { return value === null || value === undefined || value === '' ? '—' : typeof value === 'boolean' ? (value ? this.locale.text('Yes', 'نعم') : this.locale.text('No', 'لا')) : String(value); }
}
