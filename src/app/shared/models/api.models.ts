export type DataType =
  | 'TEXT' | 'LONGTEXT' | 'INTEGER' | 'DECIMAL' | 'MONEY' | 'BOOLEAN'
  | 'DATE' | 'DATETIME' | 'LOOKUP' | 'MULTISELECT' | 'FILE' | 'SECTION';

export interface PermitType {
  code: string;
  nameEn: string;
  nameAr: string;
  category: string | null;
  tableName: string;
  workflowCode: string | null;
  defaultType: boolean;
  active: boolean;
  catalogRev: number;
}

export interface PermitField {
  permitTypeCode: string;
  fieldKey: string;
  columnName: string | null;
  dataType: DataType;
  length: number | null;
  precision: number | null;
  scale: number | null;
  required: boolean;
  requiredWhen: string | null;
  defaultValue: string | null;
  lookupCode: string | null;
  labelEn: string;
  labelAr: string;
  helpEn: string | null;
  helpAr: string | null;
  sectionCode: string | null;
  sortOrder: number;
  ruleMin: number | null;
  ruleMax: number | null;
  rulePattern: string | null;
  syncState: 'PENDING' | 'LIVE' | 'RETIRED';
}

export interface PermitForm { type: PermitType; fields: PermitField[]; }
export interface AdminPermitForm extends PermitForm { activeFields: PermitField[]; }
export interface LookupValue { id: number; code: string; labelEn: string; labelAr: string; sortOrder: number; active: boolean; }
export interface Lookup { code: string; nameEn: string; nameAr: string; active: boolean; values: LookupValue[]; }
export interface FileAnswer { fileRef: string; fileName: string; mimeType: string; sizeBytes: number; status?: string; uploadedBy?: string; }
export interface PermitAnswers { applicationId: number; permitTypeCode: string; answers: Record<string, unknown>; ignoredKeys: string[]; }

export interface PermitApplication {
  id: number; referenceNo: string; eventId: number; permitTypeCode: string; status: string;
  locationText: string | null; attendeeCount: number | null; activityFrom: string | null; activityTo: string | null;
  submittedAt?: string | null; decidedAt?: string | null; validFrom?: string | null; validTo?: string | null;
  createdBy?: string | null; createdAt?: string | null;
}

export interface PermitApplicationCreate {
  eventId: number; permitTypeCode: string; locationText?: string | null; attendeeCount?: number | null;
  activityFrom?: string | null; activityTo?: string | null;
}

export interface EventSummary {
  id: number; referenceNo: string; nameEn: string; nameAr: string | null; categoryCode: string;
  organizerId: number; organizerName: string | null; venueText: string | null; status: string;
  startDate: string | null; endDate: string | null; attendeeCount?: number | null;
  submittedAt?: string | null; decidedAt?: string | null; createdAt?: string | null;
}

export interface EventRequest {
  nameEn: string; nameAr?: string | null; categoryCode: string;
  venueText?: string | null; attendeeCount?: number | null; startDate?: string | null; endDate?: string | null;
}

export interface WorkflowTask {
  id: number; subjectType: 'EVENT' | 'PERMIT'; subjectId: number; stepCode: string; round: number;
  workflowCode: string; sequence: number; kind: string; titleEn: string; titleAr: string; roleCode: string | null;
  status: string; outcome: string | null; comment: string | null; assignedTo: string | null; dueAt: string | null;
  startedAt: string | null; completedBy: string | null; completedAt: string | null; version: number;
  adapterCode?: string | null; attempts?: number; lastError?: string | null; correlationId?: string | null;
}

export interface TaskOptions { allowedOutcomes: string[]; returnTargetSteps: string[]; }
export interface ExternalCheck { adapterCode: string | null; status: string; message: string | null; correlationId: string | null; attempts: number; }
export interface WorkflowTransition { id: number; fromStep: string | null; toStep: string | null; fromRound: number | null; toRound: number | null; action: string; actor: string; reason: string | null; at: string; }
export interface WorkflowHistory { subjectType: 'EVENT' | 'PERMIT'; subjectId: number; tasks: WorkflowTask[]; transitions: WorkflowTransition[]; }

export type SearchScope = 'APPLICATION' | 'EVENT' | 'DYNAMIC' | 'MULTISELECT' | 'FILE';
export interface SearchFieldRef { scope: SearchScope; permitTypeCode?: string | null; fieldKey: string; }
export interface SearchField {
  scope: SearchScope; permitTypeCode: string | null; fieldKey: string; labelEn: string; labelAr: string;
  dataType: DataType; lookupCode: string | null; operators: string[]; sortable: boolean;
}
export interface SearchFields { fields: SearchField[]; }
export interface SearchCondition { field: SearchFieldRef; operator: string; value?: unknown; }
export interface SearchNode { logic?: 'AND' | 'OR'; children?: SearchNode[]; condition?: SearchCondition; }
export interface SearchSort { field: SearchFieldRef; direction: 'ASC' | 'DESC'; }
export interface PermitSearchRequest { permitTypes: string[]; keyword?: string | null; filter?: SearchNode | null; sort?: SearchSort[]; page: number; size: number; }
export interface PermitSearchHit {
  applicationId: number; referenceNo: string; permitTypeCode: string; permitTypeNameEn: string; permitTypeNameAr: string;
  status: string; eventId: number; eventReferenceNo: string; eventNameEn: string; eventNameAr: string; createdAt: string;
}
export interface PageResult<T> { content: T[]; page: number; size: number; totalElements: number; totalPages: number; }

export interface SchemaOperation { type: string; fieldKey: string | null; target: string; sql: string; rowEstimate: number; metadataOnly: boolean; lockRisk: string; reason: string; }
export interface SchemaPlan { permitTypeCode: string; tableName: string; rowEstimate: number; operations: SchemaOperation[]; orphanColumns: string[]; conformant: boolean; }
export interface SchemaChange { id: number; permitTypeCode?: string; operation: string; target: string; sql: string; reason: string | null; status: 'PLANNED' | 'APPROVED' | 'APPLIED' | 'FAILED' | 'REJECTED'; rowEstimate: number | null; metadataOnly: boolean | null; createdBy: string; createdAt: string; approvedBy: string | null; appliedAt: string | null; error: string | null; }
export interface WorkflowStepDefinition { workflowCode: string; stepCode: string; sequence: number; kind: string; titleEn: string; titleAr: string; roleCode: string | null; adapterCode: string | null; conditionCode: string | null; slaDays: number | null; applicantStep: boolean; allowReturnPrevious: boolean; allowReturnApplicant: boolean; allowReject: boolean; returnTargetStep: string | null; }
export interface WorkflowDefinition { code: string; subjectType: 'EVENT' | 'PERMIT'; subjectCode: string; nameEn: string; nameAr: string; applicantReturnMode: string; active: boolean; definitionRev: number; steps: WorkflowStepDefinition[]; }
export interface ReconciliationReport { tasksAdded: number; tasksUpdated: number; tasksObsoleted: number; tasksBlockedForManualReview: number; subjectsTouched: number; }

export interface ApiProblem { type: string; title: string; status: number; detail: string; errors: { field: string; code: string; message: string }[]; traceId: string; }

export interface DefinitionPublication {
  definition: PermitForm; baseDefinition: PermitForm | null;
  publicationId: number; permitTypeCode: string; definitionRev: number; draftRev: number;
  baseActiveDefinitionRev: number | null; activeDefinitionRev: number | null;
  publicationState: 'SCHEMA_PENDING' | 'ACTIVE' | 'REJECTED'; definitionFingerprint: string; planFingerprint: string;
  mode: 'AUTO' | 'REVIEW'; baseline: boolean; approvalRequired: boolean; approvedBy: string | null;
  version: number; plan: SchemaPlan; remainingPlan: SchemaPlan | null; changeIds: number[]; verifiedAt: string | null; activatedAt: string | null;
  verificationEvidence: string | null; lastAttemptStatus: string; lastError: string | null;
  failedOperation: string | null; nextAction: 'NONE' | 'EDIT_DRAFT' | 'REVIEW' | 'APPLY' | 'RETRY';
  createdBy: string; createdAt: string;
  validationStatus: 'NOT_RUN' | 'PASSED' | 'FAILED'; validatedAt: string | null; validatedBy: string | null; validationMessage: string | null;
  rejectedAt: string | null; rejectedBy: string | null; rejectionReason: string | null;
}
