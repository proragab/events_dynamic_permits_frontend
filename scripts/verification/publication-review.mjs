// Run after backend/scripts/verification/publication_review.py; no test framework.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';

const source = readFileSync(new URL('../../src/app/features/admin/permit-types/publication-review.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const { definitionChanges } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const p = JSON.parse(readFileSync('/tmp/publication-review-fixture.json', 'utf8'));
let passed = 0;
function check(name, condition) { assert.ok(condition, name); passed++; console.log(`PASS: ${name}`); }
const changes = definitionChanges(p.baseDefinition, p.definition, 'Permit details');
check('Review groups exactly the changed details and three affected fields', changes.length === 4);
check('Type rename displays old and new values', changes[0].rows.some(r => r.key === 'nameEn' && r.before === p.baseDefinition.type.nameEn && r.after === 'Reviewed permit name'));
check('Field rename displays only the changed setting', changes.find(c => c.key === 'name').rows.length === 1 && changes.find(c => c.key === 'name').rows[0].after === 'Business name');
check('Retirement displays the old field as removed', changes.find(c => c.key === 'remove_me').kind === 'retired' && changes.find(c => c.key === 'remove_me').rows.every(r => r.after === undefined));
check('Addition displays the new field with no previous value', changes.find(c => c.key === 'new_field').kind === 'added' && changes.find(c => c.key === 'new_field').rows.every(r => r.before === undefined));
const internalOnly = structuredClone(p.baseDefinition);
internalOnly.type.catalogRev += 10;
internalOnly.fields.forEach(f => { f.syncState = 'PENDING'; });
check('Draft counters and readiness do not appear as user changes', definitionChanges(p.baseDefinition, internalOnly, 'Details').length === 0);
check('Unchanged definition has an empty review', definitionChanges(p.definition, p.definition, 'Details').length === 0);
const newDefinition = definitionChanges(null, p.definition, 'Details');
check('First publication shows every new field and the new type', newDefinition.length === p.definition.fields.length + 1 && newDefinition.every(c => c.kind === 'added'));
console.log(`${passed} review comparison checks passed`);
