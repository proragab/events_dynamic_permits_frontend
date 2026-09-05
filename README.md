# ENJZ Permits UI

Angular 22 standalone frontend for the V5 Events and Permits platform.

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

```powershell
$env:Path='C:\Users\rsobh\AppData\Roaming\nvm\v22.22.3;' + $env:Path
npm start
```

The development proxy forwards `/api` to the backend on port 8080.

## Production build

```powershell
npm run build
```

No frontend test classes are included by explicit project instruction. Verification uses production builds and live backend/browser smoke checks.
