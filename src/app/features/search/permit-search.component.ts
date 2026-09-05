import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { PermitsApiService } from '../../core/api/permits-api.service';
import { LocaleService } from '../../core/i18n/locale.service';
import { ApiProblem, LookupValue, PageResult, PermitSearchHit, PermitSearchRequest, PermitType,
  SearchCondition, SearchField, SearchNode } from '../../shared/models/api.models';

interface ConditionDraft { fieldToken: string; operator: string; value: string; }

@Component({
  selector: 'app-permit-search',
  imports: [FormsModule, RouterLink],
  templateUrl: './permit-search.component.html',
  styleUrl: './permit-search.component.scss'
})
export class PermitSearchComponent {
  private readonly api = inject(PermitsApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly locale = inject(LocaleService);

  readonly permitTypes = signal<PermitType[]>([]);
  readonly fields = signal<SearchField[]>([]);
  readonly result = signal<PageResult<PermitSearchHit> | null>(null);
  readonly lookups = signal<Record<string, LookupValue[]>>({});
  readonly loading = signal(false);
  readonly error = signal('');
  readonly mode = signal<'quick' | 'advanced'>('quick');
  readonly conditions = signal<ConditionDraft[]>([{ fieldToken: '', operator: '', value: '' }]);

  selectedType = '';
  keyword = '';
  status = '';
  dateFrom = '';
  dateTo = '';
  logic: 'AND' | 'OR' = 'AND';
  pageSize = 25;

  constructor() {
    this.keyword = this.route.snapshot.queryParamMap.get('q') ?? '';
    this.selectedType = this.route.snapshot.queryParamMap.get('type') ?? '';
    this.status = this.route.snapshot.queryParamMap.get('status') ?? '';
    forkJoin({ types: this.api.permitTypes(), fields: this.api.searchFields() })
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: ({ types, fields }) => { this.permitTypes.set(types); this.fields.set(fields.fields); this.run(0); },
        error: error => this.fail(error)
      });
  }

  setMode(mode: 'quick' | 'advanced'): void { this.mode.set(mode); }
  fieldLabel(field: SearchField): string { return this.locale.text(field.labelEn, field.labelAr); }
  typeLabel(type: PermitType): string { return this.locale.text(type.nameEn, type.nameAr); }
  hitType(hit: PermitSearchHit): string { return this.locale.text(hit.permitTypeNameEn, hit.permitTypeNameAr); }
  hitEvent(hit: PermitSearchHit): string { return this.locale.text(hit.eventNameEn, hit.eventNameAr); }
  fieldToken(field: SearchField): string { return `${field.scope}|${field.permitTypeCode ?? ''}|${field.fieldKey}`; }
  selectedField(draft: ConditionDraft): SearchField | undefined {
    return this.fields().find(field => this.fieldToken(field) === draft.fieldToken);
  }
  eligibleFields(): SearchField[] {
    return this.fields().filter(field => !field.permitTypeCode || !this.selectedType || field.permitTypeCode === this.selectedType);
  }
  values(draft: ConditionDraft): LookupValue[] {
    const field = this.selectedField(draft);
    return field?.lookupCode ? this.lookups()[field.lookupCode] ?? [] : [];
  }
  noValue(operator: string): boolean {
    return ['IS_NULL', 'IS_NOT_NULL', 'IS_EMPTY', 'IS_NOT_EMPTY', 'EXISTS', 'NOT_EXISTS'].includes(operator);
  }
  listValue(operator: string): boolean {
    return ['IN', 'BETWEEN', 'CONTAINS_ANY', 'CONTAINS_ALL', 'CONTAINS_NONE'].includes(operator);
  }

  typeChanged(): void {
    this.conditions.set([{ fieldToken: '', operator: '', value: '' }]);
  }

  fieldChanged(index: number): void {
    const drafts = [...this.conditions()];
    drafts[index] = { ...drafts[index], operator: '', value: '' };
    this.conditions.set(drafts);
    const field = this.selectedField(drafts[index]);
    if (field?.lookupCode && !this.lookups()[field.lookupCode]) {
      this.api.lookup(field.lookupCode).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(lookup =>
        this.lookups.update(current => ({ ...current, [lookup.code]: lookup.values.filter(value => value.active) })));
    }
  }

  updateCondition(index: number, property: keyof ConditionDraft, value: string): void {
    const drafts = [...this.conditions()];
    drafts[index] = { ...drafts[index], [property]: value };
    this.conditions.set(drafts);
  }
  addCondition(): void { this.conditions.update(items => [...items, { fieldToken: '', operator: '', value: '' }]); }
  removeCondition(index: number): void { this.conditions.update(items => items.filter((_, itemIndex) => itemIndex !== index)); }

  run(page = 0): void {
    if (!this.permitTypes().length) return;
    this.loading.set(true); this.error.set('');
    const request = this.mode() === 'quick' ? this.quickRequest(page) : this.advancedRequest(page);
    this.router.navigate([], { queryParams: {
      q: this.keyword || null, type: this.selectedType || null, status: this.status || null, mode: this.mode()
    }, queryParamsHandling: 'merge', replaceUrl: true });
    this.api.search(request).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: result => { this.result.set(result); this.loading.set(false); },
      error: error => this.fail(error)
    });
  }

  private quickRequest(page: number): PermitSearchRequest {
    const conditions: SearchNode[] = [];
    if (this.status) conditions.push(this.node({ scope: 'APPLICATION', fieldKey: 'status' }, 'EQ', this.status));
    if (this.dateFrom) conditions.push(this.node({ scope: 'EVENT', fieldKey: 'startDate' }, 'AFTER', this.dateFrom));
    if (this.dateTo) conditions.push(this.node({ scope: 'EVENT', fieldKey: 'endDate' }, 'BEFORE', this.dateTo));
    return { permitTypes: this.selectedTypes(), keyword: this.keyword || null,
      filter: conditions.length ? { logic: 'AND', children: conditions } : null, page, size: this.pageSize };
  }

  private advancedRequest(page: number): PermitSearchRequest {
    const children = this.conditions().filter(draft => draft.fieldToken && draft.operator).map(draft => {
      const field = this.selectedField(draft)!;
      const value = this.convertValue(field, draft.operator, draft.value);
      return this.node({ scope: field.scope, permitTypeCode: field.permitTypeCode, fieldKey: field.fieldKey }, draft.operator, value);
    });
    return { permitTypes: this.selectedTypes(), filter: children.length ? { logic: this.logic, children } : null,
      page, size: this.pageSize };
  }

  private selectedTypes(): string[] {
    return this.selectedType ? [this.selectedType] : this.permitTypes().map(type => type.code);
  }

  private node(field: SearchCondition['field'], operator: string, value?: unknown): SearchNode {
    return { condition: { field, operator, ...(value === undefined ? {} : { value }) } };
  }

  private convertValue(field: SearchField, operator: string, raw: string): unknown {
    if (this.noValue(operator)) return undefined;
    const values = this.listValue(operator) ? raw.split(',').map(value => value.trim()).filter(Boolean) : null;
    const convert = (value: string): unknown => {
      if (['INTEGER', 'DECIMAL', 'MONEY'].includes(field.dataType)) return Number(value);
      if (field.dataType === 'BOOLEAN') return value === 'true';
      return value;
    };
    return values ? values.map(convert) : convert(raw);
  }

  private fail(error: unknown): void {
    const response = error as HttpErrorResponse;
    const problem = response.error as ApiProblem | undefined;
    this.error.set(problem?.detail || response.message || 'Search failed');
    this.loading.set(false);
  }
}
