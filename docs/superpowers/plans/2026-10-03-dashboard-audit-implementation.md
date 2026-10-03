# Dashboard Audit Implementation Plan

**Goal:** Apply the approved dashboard design without changing storage, AI providers,
bank reconciliation, transaction schema, or export formats.

**Architecture:** Keep app.js business logic and existing field IDs. Replace the
layered stylesheet with one theme-aware component system. A small dashboard-ui.js
owns native dialogs, entry tabs, responsive mounting, confirmations and icons.

**Tech Stack:** Vanilla HTML/CSS/JavaScript; local Lucide and IBM Plex font;
Node test runner with jsdom; existing XLSX/parser and Netlify functions.

## Constraints
- No deployment, push, or credential changes in this implementation turn.
- Keep untracked audit/mockup artifacts intact.
- Keep Rupiah input formatting and raw integer storage/export values.
- Keep full history export and real backup import, not mockup simulations.
- Monthly totals do not follow category/date/search filters. Trends use history.
- Small screens retain inline chat/manual entry and a transaction-detail trigger.

## Tasks
1. [x] Regression harness: exercise real app.js with isolated DOM/storage and fixture
   requests. Test month totals/history, category filtering, entry/edit metadata,
   CSV/Excel round trips and draft-before-save. Run red tests first.
2. [x] Integrate HTML and assets: compact header, burger left, four metrics,
   chart band, category cards, ledger, entry tabs, native dialogs. Preserve IDs
   and parser dependency order. Replace styles.css rather than append overrides.
3. [x] Add dashboard-ui.js: mount entry/details/search by viewport; modal top layer,
   Escape/focus restoration, confirmations, icon rendering and responsive status.
4. [x] Wire app.js: category -> table filters, metric count/period, meaningful
   category shares, accessible chart tables, dialog entry modes, form validity,
   request feedback and preserving bank reference metadata on manual edits.
5. [x] Run npm test and Node syntax checks. Browser tests at 320/390/768/820/1024/
   1440px, both themes, dialogs, keyboard, long names/large numbers and empty data.
   Use synthetic transactions and local endpoints only for destructive tests.
6. [x] Capture desktop/mobile screenshots and write verification results. Leave a
   local application preview for user review. Do not commit/push automatically.
