# Separate Financial Books Implementation Plan

> **For agentic workers:** Use subagent-driven-development for the bounded model/API task and parent-led UI integration. Review each task and run the complete regression suite before delivery.

**Goal:** Dedicated installment and savings/investment/deposit pages with separate balances, online persistence and restorable backups.

**Architecture:** A pure UMD domain model validates the separate account/entry state on both server and browser. An authenticated function persists revisioned mutations in a dedicated Postgres table. A browser controller owns routing, forms, local queue and special-book backups, with minimal existing-session hooks in app.js.

**Tech Stack:** Existing vanilla JS, native dialogs, CSS, Lucide, XLSX, Node test runner/jsdom, Netlify Functions/Postgres.

## Global Constraints

- Do not add special entries to `state.transactions` or change daily totals, categories, bank reconciliation or AI provider.
- Use whole Rupiah with dot thousands separators and server-side validation.
- Do not move previous category records automatically or mutate production data during verification.
- Preserve untracked audit/preview folders; no unrelated refactoring; no production push in this request.

### Task 1: Domain Model and Authenticated Persistence

**Files:** Create `financial-books-model.js`, `netlify/functions/financial-books.js`, `tests/financial-books-model.test.cjs`, `tests/financial-books-api.test.cjs`; export the existing database pool from `netlify/functions/transactions.js`.

**Interfaces:** `FinancialBooksModel.emptyState()` -> `{accounts:[],entries:[]}`; `validateState(books)` returns validated books or throws; `applyOperation(books,operation)` returns a new validated state; `summarizeAccount(account,entries)` -> `{paid,remaining,balance,deposits,withdrawals}`. Operations carry stable `id`, `type`, `record` for upsert; `recordId` for delete; `cascade:true` to delete parent with history; `books` for restore. `mergeBackup(existing,incoming)` -> `{books,addedAccounts,addedEntries,duplicates,changed}`. Endpoint GET returns `{books,revision}`; POST accepts `{baseRevision,operation}`; conflicts are 409. Failed responses never acknowledge unsaved operations.

- [x] Test arithmetic, types, impossible dates, parent references, chronological negative balances, overpayment and deterministic restore.
- [x] Implement immutable validation and operation application; run model tests until green.
- [x] Test isolated API token/workspace/method checks, revisions and idempotent retry.
- [x] Implement parametrized revision-checked operations, durable operation ledger, safe errors and no main-book migration.

### Task 2: Separate Pages, Session and Queue

**Files:** Create `financial-books.js`, `financial-books.css`, `tests/financial-books-ui.test.cjs`; modify `index.html`, `dashboard-ui.js`, `app.js`, `tests/helpers/app-harness.cjs`.

**Interfaces:** `FinancialBooks.startSession({workspaceId,accessToken,isLocalOnly})`, `endSession()`, `showDashboard()`, `getBooks()`, `exportRows()`, `parseBackup(workbook)`, `reviewImport(books)`. App initialization starts the separate session; logout clears it. Ordinary entry/detail routes first call `showDashboard()`.

- [x] Test hidden independent routes, CRUD, form modes, exact currency formatting, confirmations and dashboard immutability.
- [x] Implement accessible route-based views, page-only forms, native confirmations, per-detail month controls and lifetime summaries.
- [x] Persist pending commands locally per workspace; process serially after initial GET; refetch/revalidate on 409; retain queue on failure; cancel stale-session results and provide retry.
- [x] Test reload, remote errors, workspace switching, cross-tab write locks, stale forms and deferred responses.

### Task 3: Restorable CSV/Excel and Production Packaging

**Files:** Modify `app.js`, `scripts/build-static.cjs`, `tests/build-static.test.cjs`; create `tests/financial-books-backup.test.cjs`; extend `tests/preview-server.cjs` for isolated fixture endpoint.

- [x] Test CSV and XLSX roundtrip/duplicate imports, including large values and IDs preserved as text.
- [x] Add tagged special-record export rows and separate workbook sheet. Exclude all special versions from ordinary parser fallback. Confirm additive restore; reject invalid/unsupported rows and report changed IDs skipped.
- [x] Include both new browser modules/CSS in static allowlist and build test.
- [x] Extend local fixture API without contacting live databases or AI.

### Task 4: Review and Verification

- [x] Run regression suite, production build, JS syntax checks and whitespace check. See verification report for final results.
- [x] Review data loss, auth, routing, backup and async races; fix findings with regression tests.
- [x] Verify local desktop and 320/390/768px mobile/tablet, light/dark, populated/empty states, dialogs, currency and form submission.
- [x] Record limitations and preview URL. Live Netlify persistence is not claimed as tested.
