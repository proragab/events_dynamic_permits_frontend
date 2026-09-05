import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { PermitsApiService } from '../../../core/api/permits-api.service';
import { ReconciliationReport, WorkflowDefinition, WorkflowStepDefinition } from '../../../shared/models/api.models';
import { adminErrorMessage } from '../admin-error';

type WorkflowTab = 'details' | 'steps' | 'reconciliation';

@Component({ selector: 'app-workflow-editor', imports: [FormsModule, RouterLink], templateUrl: './workflow-editor.component.html' })
export class WorkflowEditorComponent {
  private readonly api = inject(PermitsApiService); private readonly route = inject(ActivatedRoute); private readonly router = inject(Router); private readonly destroyRef = inject(DestroyRef);
  readonly code = this.route.snapshot.paramMap.get('code') ?? ''; readonly isEdit = !!this.code;
  readonly workflow = signal<WorkflowDefinition | null>(null); readonly roles = signal<string[]>([]); readonly conditions = signal<string[]>([]); readonly adapters = signal<string[]>([]);
  readonly tab = signal<WorkflowTab>('details'); readonly impact = signal<ReconciliationReport | null>(null); readonly loading = signal(true); readonly saving = signal(false); readonly error = signal(''); readonly message = signal(''); readonly stepEditorOpen = signal(false);
  editingStepCode = '';
  form = { code: '', subjectType: 'PERMIT' as 'EVENT' | 'PERMIT', subjectCode: '', nameEn: '', nameAr: '', applicantReturnMode: 'RESUME', active: false };
  stepForm = this.emptyStep();
  constructor() {
    forkJoin({ workflows: this.api.workflows(), roles: this.api.workflowRoles(), conditions: this.api.workflowConditions(), adapters: this.api.workflowAdapters() }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ workflows, roles, conditions, adapters }) => { this.roles.set([...roles].sort()); this.conditions.set([...conditions].sort()); this.adapters.set([...adapters].sort()); if (this.isEdit) { const workflow = workflows.find((item) => item.code === this.code) ?? null; this.workflow.set(workflow); if (workflow) this.form = { code: workflow.code, subjectType: workflow.subjectType, subjectCode: workflow.subjectCode, nameEn: workflow.nameEn, nameAr: workflow.nameAr, applicantReturnMode: workflow.applicantReturnMode, active: workflow.active }; else this.error.set('Workflow not found.'); } this.loading.set(false); }, error: (error) => this.fail(error),
    });
  }
  saveWorkflow(): void { this.beginSave(); const payload = { ...this.form, code: this.form.code.trim().toUpperCase(), subjectCode: this.form.subjectCode.trim().toUpperCase() }; const request = this.isEdit ? this.api.updateWorkflow(this.code, payload) : this.api.createWorkflow(payload); request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (workflow) => { this.saving.set(false); if (!this.isEdit) this.router.navigate(['/admin/workflows', workflow.code, 'edit']); else { this.workflow.set(workflow); this.ok('Workflow saved and validated.'); } }, error: (error) => this.fail(error) }); }
  sortedSteps(): WorkflowStepDefinition[] { return [...(this.workflow()?.steps ?? [])].sort((a, b) => a.sequence - b.sequence); }
  earlierSteps(): WorkflowStepDefinition[] { return this.sortedSteps().filter((step) => step.stepCode !== this.editingStepCode && step.sequence < this.stepForm.sequence); }
  isHuman(kind: string): boolean { return kind === 'FORM' || kind === 'REVIEW'; } isAdapter(kind: string): boolean { return ['EXTERNAL', 'PAYMENT', 'NOTIFY'].includes(kind); } supportsExternalCheck(kind: string): boolean { return kind === 'REVIEW' || this.isAdapter(kind); }
  startNewStep(): void { this.editingStepCode = ''; this.stepForm = this.emptyStep(); this.stepEditorOpen.set(true); this.clearNotices(); }
  editStep(step: WorkflowStepDefinition): void { this.editingStepCode = step.stepCode; this.stepForm = { stepCode: step.stepCode, sequence: step.sequence, kind: step.kind, titleEn: step.titleEn, titleAr: step.titleAr, roleCode: step.roleCode ?? '', adapterCode: step.adapterCode ?? '', conditionCode: step.conditionCode ?? '', slaDays: step.slaDays, applicantStep: step.applicantStep, allowReturnPrevious: step.allowReturnPrevious, allowReturnApplicant: step.allowReturnApplicant, allowReject: step.allowReject, returnTargetStep: step.returnTargetStep ?? '' }; this.stepEditorOpen.set(true); this.clearNotices(); }
  closeStepEditor(): void { this.stepEditorOpen.set(false); this.editingStepCode = ''; }
  saveStep(): void { this.beginSave(); const editing = !!this.editingStepCode; const { stepCode, ...rest } = this.stepForm; const payload = { ...(editing ? rest : { stepCode: stepCode.trim().toUpperCase(), ...rest }), roleCode: this.isHuman(this.stepForm.kind) ? this.stepForm.roleCode : null, adapterCode: this.supportsExternalCheck(this.stepForm.kind) ? (this.stepForm.adapterCode || null) : null, conditionCode: this.stepForm.conditionCode || null, returnTargetStep: this.stepForm.returnTargetStep || null, slaDays: this.stepForm.slaDays };
    const request = editing ? this.api.updateWorkflowStep(this.code, this.editingStepCode, payload) : this.api.addWorkflowStep(this.code, payload); request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (workflow) => { this.workflow.set(workflow); this.saving.set(false); this.closeStepEditor(); this.ok(editing ? 'Workflow step updated.' : 'Workflow step added.'); }, error: (error) => this.fail(error) }); }
  retireStep(step: WorkflowStepDefinition): void { this.beginSave(); this.api.retireWorkflowStep(this.code, step.stepCode).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (workflow) => { this.workflow.set(workflow); this.saving.set(false); this.ok('Workflow step retired.'); }, error: (error) => this.fail(error) }); }
  loadImpact(): void { this.beginSave(); this.api.reconcileImpact(this.code).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (impact) => { this.impact.set(impact); this.saving.set(false); this.ok('Impact preview loaded.'); }, error: (error) => this.fail(error) }); }
  applyReconcile(): void { this.beginSave(); this.api.reconcile(this.code).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (impact) => { this.impact.set(impact); this.saving.set(false); this.ok('Running workflow tasks reconciled.'); }, error: (error) => this.fail(error) }); }
  private emptyStep() { return { stepCode: '', sequence: 10, kind: 'REVIEW', titleEn: '', titleAr: '', roleCode: '', adapterCode: '', conditionCode: '', slaDays: null as number | null, applicantStep: false, allowReturnPrevious: true, allowReturnApplicant: true, allowReject: true, returnTargetStep: '' }; }
  private beginSave(): void { this.saving.set(true); this.clearNotices(); } private clearNotices(): void { this.error.set(''); this.message.set(''); }
  private ok(message: string): void { this.error.set(''); this.message.set(message); } private fail(error: unknown): void { this.error.set(adminErrorMessage(error)); this.loading.set(false); this.saving.set(false); }
}
