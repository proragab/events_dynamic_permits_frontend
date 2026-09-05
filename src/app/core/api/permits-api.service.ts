import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  EventRequest,
  EventSummary,
  ExternalCheck,
  Lookup,
  LookupValue,
  PageResult,
  PermitAnswers,
  PermitApplication,
  PermitApplicationCreate,
  PermitField,
  PermitForm,
  AdminPermitForm,
  PermitSearchHit,
  PermitSearchRequest,
  PermitType,
  DefinitionPublication,
  ReconciliationReport,
  SchemaPlan,
  SchemaChange,
  SearchFields,
  TaskOptions,
  WorkflowDefinition,
  WorkflowHistory,
  WorkflowTask,
} from '../../shared/models/api.models';

@Injectable({ providedIn: 'root' })
export class PermitsApiService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api';

  events(): Observable<EventSummary[]> {
    return this.http.get<EventSummary[]>(`${this.base}/events`);
  }
  event(id: number): Observable<EventSummary> {
    return this.http.get<EventSummary>(`${this.base}/events/${id}`);
  }
  createEvent(request: EventRequest): Observable<EventSummary> {
    return this.http.post<EventSummary>(`${this.base}/events`, request);
  }
  updateEvent(id: number, request: EventRequest): Observable<EventSummary> {
    return this.http.put<EventSummary>(`${this.base}/events/${id}`, request);
  }
  submitEvent(id: number): Observable<unknown> {
    return this.http.post(`${this.base}/events/${id}/submit`, {});
  }
  eventApplications(id: number): Observable<PermitApplication[]> {
    return this.http.get<PermitApplication[]>(`${this.base}/events/${id}/applications`);
  }
  permitTypes(): Observable<PermitType[]> {
    return this.http.get<PermitType[]>(`${this.base}/catalog/types`);
  }
  createApplication(request: PermitApplicationCreate): Observable<PermitApplication> {
    return this.http.post<PermitApplication>(`${this.base}/applications`, request);
  }
  application(id: number): Observable<PermitApplication> {
    return this.http.get<PermitApplication>(`${this.base}/applications/${id}`);
  }
  form(typeCode: string): Observable<PermitForm> {
    return this.http.get<PermitForm>(`${this.base}/catalog/types/${typeCode}/form`);
  }
  lookup(code: string): Observable<Lookup> {
    return this.http.get<Lookup>(`${this.base}/lookups/${code}`);
  }
  answers(id: number): Observable<PermitAnswers> {
    return this.http.get<PermitAnswers>(`${this.base}/applications/${id}/answers`);
  }
  patchAnswers(id: number, answers: Record<string, unknown>): Observable<PermitAnswers> {
    return this.http.patch<PermitAnswers>(`${this.base}/applications/${id}/answers`, answers);
  }
  submitApplication(id: number): Observable<unknown> {
    return this.http.post(`${this.base}/applications/${id}/submit`, {});
  }
  resubmitApplication(id: number): Observable<unknown> {
    return this.http.post(`${this.base}/applications/${id}/resubmit`, {});
  }
  tasks(): Observable<WorkflowTask[]> {
    return this.http.get<WorkflowTask[]>(`${this.base}/tasks/queue`);
  }
  task(id: number): Observable<WorkflowTask> {
    return this.http.get<WorkflowTask>(`${this.base}/tasks/${id}`);
  }
  taskOptions(id: number): Observable<TaskOptions> {
    return this.http.get<TaskOptions>(`${this.base}/tasks/${id}/options`);
  }
  externalCheck(id: number): Observable<ExternalCheck> {
    return this.http.get<ExternalCheck>(`${this.base}/tasks/${id}/external-check`);
  }
  runExternalCheck(id: number): Observable<ExternalCheck> {
    return this.http.post<ExternalCheck>(`${this.base}/tasks/${id}/external-check`, {});
  }
  claimTask(id: number): Observable<WorkflowTask> {
    return this.http.post<WorkflowTask>(`${this.base}/tasks/${id}/claim`, {});
  }
  decideTask(
    id: number,
    outcome: string,
    comment: string,
    returnTargetStep?: string | null,
  ): Observable<WorkflowTask> {
    return this.http.post<WorkflowTask>(`${this.base}/tasks/${id}/decision`, {
      outcome,
      comment,
      returnTargetStep,
    });
  }
  workflowHistory(type: 'EVENT' | 'PERMIT', id: number): Observable<WorkflowHistory> {
    const path = type === 'EVENT' ? `events/${id}/history` : `applications/${id}/history`;
    return this.http.get<WorkflowHistory>(`${this.base}/${path}`);
  }
  searchFields(types?: string[]): Observable<SearchFields> {
    const query = types?.length ? `?permitTypeCodes=${types.join(',')}` : '';
    return this.http.get<SearchFields>(`${this.base}/search/fields${query}`);
  }
  search(request: PermitSearchRequest): Observable<PageResult<PermitSearchHit>> {
    return this.http.post<PageResult<PermitSearchHit>>(`${this.base}/search/permits`, request);
  }
  adminLookups(): Observable<Lookup[]> {
    return this.http.get<Lookup[]>(`${this.base}/admin/lookups`);
  }
  adminPermitTypes(): Observable<PermitType[]> {
    return this.http.get<PermitType[]>(`${this.base}/admin/catalog/types`);
  }
  adminPermitDefinition(code: string): Observable<AdminPermitForm> {
    return this.http.get<AdminPermitForm>(`${this.base}/admin/catalog/types/${code}`);
  }
  createLookup(request: Record<string, unknown>): Observable<Lookup> {
    return this.http.post<Lookup>(`${this.base}/admin/lookups`, request);
  }
  updateLookup(code: string, request: Record<string, unknown>): Observable<Lookup> {
    return this.http.put<Lookup>(`${this.base}/admin/lookups/${code}`, request);
  }
  addLookupValue(code: string, request: Record<string, unknown>): Observable<LookupValue> {
    return this.http.post<LookupValue>(`${this.base}/admin/lookups/${code}/values`, request);
  }
  updateLookupValue(
    code: string,
    valueId: number,
    request: Record<string, unknown>,
  ): Observable<LookupValue> {
    return this.http.put<LookupValue>(
      `${this.base}/admin/lookups/${code}/values/${valueId}`,
      request,
    );
  }
  deactivateLookupValue(code: string, valueId: number): Observable<LookupValue> {
    return this.http.post<LookupValue>(
      `${this.base}/admin/lookups/${code}/values/${valueId}/deactivate`,
      {},
    );
  }
  createPermitType(request: Record<string, unknown>): Observable<PermitType> {
    return this.http.post<PermitType>(`${this.base}/admin/catalog/types`, request);
  }
  updatePermitType(code: string, request: Record<string, unknown>, revision: number): Observable<PermitType> {
    return this.http.put<PermitType>(`${this.base}/admin/catalog/types/${code}`, request, { headers: { 'If-Match': String(revision) } });
  }
  addPermitField(code: string, request: Record<string, unknown>, revision: number): Observable<PermitField> {
    return this.http.post<PermitField>(`${this.base}/admin/catalog/types/${code}/fields`, request, { headers: { 'If-Match': String(revision) } });
  }
  updatePermitField(code: string, fieldKey: string, request: Record<string, unknown>, revision: number): Observable<PermitField> {
    return this.http.put<PermitField>(`${this.base}/admin/catalog/types/${code}/fields/${fieldKey}`, request,
      { headers: { 'If-Match': String(revision) } });
  }
  retirePermitField(code: string, fieldKey: string, revision: number): Observable<PermitField> {
    return this.http.post<PermitField>(`${this.base}/admin/catalog/types/${code}/fields/${fieldKey}/retire`, {},
      { headers: { 'If-Match': String(revision) } });
  }
  restorePermitField(code: string, fieldKey: string, revision: number): Observable<PermitField> {
    return this.http.post<PermitField>(`${this.base}/admin/catalog/types/${code}/fields/${fieldKey}/restore`, {},
      { headers: { 'If-Match': String(revision) } });
  }
  publications(code: string): Observable<DefinitionPublication[]> {
    return this.http.get<DefinitionPublication[]>(`${this.base}/admin/catalog/types/${code}/publications`);
  }
  definitionPublications(): Observable<DefinitionPublication[]> {
    return this.http.get<DefinitionPublication[]>(`${this.base}/admin/catalog/publications`);
  }
  validatePublication(code: string, p: DefinitionPublication): Observable<DefinitionPublication> {
    return this.http.post<DefinitionPublication>(`${this.base}/admin/catalog/types/${code}/publications/validate`, {
      publicationId: p.publicationId, expectedVersion: p.version, definitionFingerprint: p.definitionFingerprint, planFingerprint: p.planFingerprint,
    });
  }
  rejectPublication(code: string, p: DefinitionPublication, reason: string): Observable<DefinitionPublication> {
    return this.http.post<DefinitionPublication>(`${this.base}/admin/catalog/types/${code}/publications/reject`, {
      publication: { publicationId: p.publicationId, expectedVersion: p.version, definitionFingerprint: p.definitionFingerprint, planFingerprint: p.planFingerprint }, reason,
    });
  }
  publication(code: string, id: number): Observable<DefinitionPublication> {
    return this.http.get<DefinitionPublication>(`${this.base}/admin/catalog/types/${code}/publications/${id}`);
  }
  publishDefinition(code: string, expectedDraftRev: number, mode: 'REVIEW' | 'AUTO'): Observable<DefinitionPublication> {
    return this.http.post<DefinitionPublication>(`${this.base}/admin/catalog/types/${code}/publish`, { expectedDraftRev, mode });
  }
  schemaPlan(code: string): Observable<SchemaPlan> {
    return this.http.get<SchemaPlan>(`${this.base}/admin/schema/types/${code}/plan`);
  }
  schemaChanges(code: string): Observable<SchemaChange[]> {
    return this.http.get<SchemaChange[]>(`${this.base}/admin/schema/types/${code}/changes`);
  }
  applyPublication(code: string, publication: DefinitionPublication, approve: boolean): Observable<DefinitionPublication> {
    return this.http.post<DefinitionPublication>(`${this.base}/admin/schema/types/${code}/${approve ? 'approve' : 'sync'}`, {
      publicationId: publication.publicationId, expectedVersion: publication.version,
      definitionFingerprint: publication.definitionFingerprint, planFingerprint: publication.planFingerprint,
    });
  }
  workflows(): Observable<WorkflowDefinition[]> {
    return this.http.get<WorkflowDefinition[]>(`${this.base}/admin/workflows`);
  }
  createWorkflow(request: Record<string, unknown>): Observable<WorkflowDefinition> {
    return this.http.post<WorkflowDefinition>(`${this.base}/admin/workflows`, request);
  }
  updateWorkflow(code: string, request: Record<string, unknown>): Observable<WorkflowDefinition> {
    return this.http.put<WorkflowDefinition>(`${this.base}/admin/workflows/${code}`, request);
  }
  addWorkflowStep(code: string, request: Record<string, unknown>): Observable<WorkflowDefinition> {
    return this.http.post<WorkflowDefinition>(
      `${this.base}/admin/workflows/${code}/steps`,
      request,
    );
  }
  updateWorkflowStep(
    code: string,
    stepCode: string,
    request: Record<string, unknown>,
  ): Observable<WorkflowDefinition> {
    return this.http.put<WorkflowDefinition>(
      `${this.base}/admin/workflows/${code}/steps/${stepCode}`,
      request,
    );
  }
  retireWorkflowStep(code: string, stepCode: string): Observable<WorkflowDefinition> {
    return this.http.post<WorkflowDefinition>(
      `${this.base}/admin/workflows/${code}/steps/${stepCode}/retire`,
      {},
    );
  }
  workflowRoles(): Observable<string[]> {
    return this.http.get<string[]>(`${this.base}/admin/workflows/registered-roles`);
  }
  workflowConditions(): Observable<string[]> {
    return this.http.get<string[]>(`${this.base}/admin/workflows/registered-conditions`);
  }
  workflowAdapters(): Observable<string[]> {
    return this.http.get<string[]>(`${this.base}/admin/workflows/registered-adapters`);
  }
  reconcileImpact(code: string): Observable<ReconciliationReport> {
    return this.http.get<ReconciliationReport>(
      `${this.base}/admin/workflows/${code}/reconcile/impact`,
    );
  }
  reconcile(code: string): Observable<ReconciliationReport> {
    return this.http.post<ReconciliationReport>(
      `${this.base}/admin/workflows/${code}/reconcile`,
      {},
    );
  }
}
