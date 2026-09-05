import { PermitField, PermitForm, PermitType } from '../../../shared/models/api.models';

type Setting<T> = { key: keyof T; en: string; ar: string };
export interface ReviewChange {
  key: string; title: string; kind: 'added' | 'changed' | 'retired';
  rows: { key: string; en: string; ar: string; before: unknown; after: unknown }[];
}
const typeSettings: Setting<PermitType>[] = [
  { key: 'nameEn', en: 'English name', ar: 'الاسم بالإنجليزية' },
  { key: 'nameAr', en: 'Arabic name', ar: 'الاسم بالعربية' },
  { key: 'category', en: 'Category', ar: 'الفئة' },
  { key: 'workflowCode', en: 'Workflow', ar: 'سير العمل' },
];
const fieldSettings: Setting<PermitField>[] = [
  { key: 'labelEn', en: 'English label', ar: 'الاسم بالإنجليزية' },
  { key: 'labelAr', en: 'Arabic label', ar: 'الاسم بالعربية' },
  { key: 'dataType', en: 'Field type', ar: 'نوع الحقل' },
  { key: 'required', en: 'Required', ar: 'مطلوب' },
  { key: 'length', en: 'Maximum length', ar: 'الطول الأقصى' },
  { key: 'precision', en: 'Total digits', ar: 'إجمالي الأرقام' },
  { key: 'scale', en: 'Decimal places', ar: 'المنازل العشرية' },
  { key: 'defaultValue', en: 'Default value', ar: 'القيمة الافتراضية' },
  { key: 'lookupCode', en: 'Lookup', ar: 'قائمة الخيارات' },
  { key: 'requiredWhen', en: 'Required when', ar: 'مطلوب عند' },
  { key: 'sectionCode', en: 'Section', ar: 'القسم' },
  { key: 'sortOrder', en: 'Order', ar: 'الترتيب' },
  { key: 'ruleMin', en: 'Minimum', ar: 'الحد الأدنى' },
  { key: 'ruleMax', en: 'Maximum', ar: 'الحد الأقصى' },
  { key: 'rulePattern', en: 'Validation pattern', ar: 'نمط التحقق' },
  { key: 'helpEn', en: 'English help', ar: 'التعليمات بالإنجليزية' },
  { key: 'helpAr', en: 'Arabic help', ar: 'التعليمات بالعربية' },
];
function rows<T>(before: T | undefined, after: T | undefined, settings: Setting<T>[]): ReviewChange['rows'] {
  return settings.filter(s => (before?.[s.key] ?? null) !== (after?.[s.key] ?? null))
    .map(s => ({ key: String(s.key), en: s.en, ar: s.ar, before: before?.[s.key], after: after?.[s.key] }));
}
/** Compare immutable metadata only; internal counters and physical readiness are not user edits. */
export function definitionChanges(before: PermitForm | null, after: PermitForm, detailsTitle: string): ReviewChange[] {
  const changes: ReviewChange[] = [];
  const details = rows(before?.type, after.type, typeSettings);
  if (details.length) changes.push({ key: '@details', title: detailsTitle, kind: before ? 'changed' : 'added', rows: details });
  const oldFields = new Map(before?.fields.map(f => [f.fieldKey, f]) ?? []);
  const newFields = new Map(after.fields.map(f => [f.fieldKey, f]));
  for (const key of new Set([...oldFields.keys(), ...newFields.keys()])) {
    const old = oldFields.get(key); const next = newFields.get(key);
    const differences = rows(old, next, fieldSettings);
    if (differences.length) changes.push({ key, title: next?.labelEn ?? old?.labelEn ?? key, kind: !old ? 'added' : !next ? 'retired' : 'changed', rows: differences });
  }
  return changes;
}
