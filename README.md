# ENJZ Permits UI

Angular 22 standalone frontend for the V5 Events and Permits platform.

Every Angular component must have its own sibling `.html` file referenced by `templateUrl`.
Do not put HTML in a TypeScript `template` property. The component generator is configured with
`inlineTemplate: false` to follow this convention for new components.

All V5 phases are complete. The frontend scope delivered through Phase 16 and verified in the
Phase 17 configuration-only acceptance run includes:

- runtime English/Arabic direction switching;
- development actor/role session abstraction;
- organizer Event and Permit Application workspace;
- metadata-driven Permit form with lookup, multiselect, and file controls;
- generic configured-role task queue, decisions, and round ledger;
- quick and metadata-driven advanced Permit search with server pagination;
- PLATFORM_ADMIN configuration console for Permit Types/fields, lookups, workflows, schema plans/approval, search metadata, and reconciliation impact.

Role-aware navigation and route guards match the backend matrix. The development identity selection is
persisted locally. The admin console exposes separate Permit Type, Lookup, and Workflow sections with
editing for definitions, fields, values, workflow metadata, and steps.

## Run

Start SQL Server and the backend using the backend README, then run from this frontend directory:

```sh
npm ci
npm start
```

Open `http://localhost:4200`. The development proxy forwards `/api/**` and `/actuator/**` to
`http://127.0.0.1:8080`. If the backend port changes, update both targets in `proxy.conf.json` and restart
the frontend dev server. Database credentials stay in the backend's ignored `.env` file.

Verify the full frontend proxy → backend → SQL Server connection:

```sh
curl --fail http://localhost:4200/api/health
```

## Production build

```sh
npm run build
```

No frontend test classes are included by explicit project instruction. Verification uses production builds and live backend/browser smoke checks.

## Definition publication editor

The editor has **Save draft** and **Submit for review**. Saving never creates a numbered version. Submission freezes
the saved definition under REVIEW and opens the independent `/admin/definition-reviews` queue. Existing pending
submissions are reused; corrections after rejection create a new numbered version and preserve the rejected one.

The sidebar contains **Definition reviews** and **Versions** (`/admin/definition-versions`). Reviews open at
`/admin/definition-reviews/:code/:publicationId`, with separate Validate, Approve, and Reject actions. Validation
records prerequisites without DDL; REVIEW approval requires successful validation and repeats final checks before
activation. Rejection requires a reason and permanently closes that version. The published definition survives.
Versions displays every frozen v1/v2/v3 snapshot, current/previous published status, pending/rejected status, submission
and decision details. Each version exposes its before/after changes and contents. Draft counters stay internal.
Later draft edits do not mutate a submitted version. A changed published base requires a new submission.
Service availability/default controls remain separate, explicitly immediate settings. Controls use EN/AR translations.

After running `backend/scripts/verification/publication_review.py` against the isolated SQL Server verification
database, run `node scripts/verification/publication-review.mjs` from the frontend folder to verify the comparison
against its captured API fixture. No new test framework is required.
