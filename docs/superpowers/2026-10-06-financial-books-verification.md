# Financial Books Verification

## Scope

Separate Cicilan and Tabungan/Investasi/Simpanan pages, independent accounting, dated history, month filters, whole-Rupiah entry, authenticated online API, local queue and restorable CSV/Excel backups. No production data, existing category records or AI configuration were migrated or changed.

## Automated Checks

Final verification commands:

- `node --test --test-reporter=spec tests/*.test.cjs`
- `npm run build`
- `node --check` for changed application modules, function modules and build/preview scripts.
- `git diff --check`

Final results on 2026-10-06: 148 tests passed, 0 failed; production build succeeded; syntax checks passed for all 8 modules/scripts; whitespace validation passed. Git emitted only normal LF-to-CRLF working-copy warnings. These checks did not commit or deploy the changes.

The regression suite covers dashboard isolation; account/entry CRUD; safe arithmetic; date/type/parent validation; overpayment and chronological overdraw; workspace/auth checks; revision races; durable duplicate acknowledgement after 256 newer operations; offline retry; cross-tab ownership; stale forms and confirmations; discard-in-flight writes; logout boundaries; unsupported backup versions; CSV/XLSX restore and duplicate prevention. Simulated offline console warnings are expected test fixtures.

## Browser Checks

Local fixture URL: `http://127.0.0.1:4177/`, with `#cicilan` and `#simpanan` routes. The fixture banner explicitly identifies example data and simulated AI. Port 4178 serves the unmodified frontend without hosted Functions.

- Tested 320, 390, 768 and 1440 pixel viewports, light/dark themes, empty and populated pages.
- On Simpanan, document scroll width matched client width at all four sizes; selected sibling layout checks found no intersections.
- Payment Rp5.012.278 reduced the example obligation correctly. Withdrawal Rp250.000 reduced the example savings balance correctly.
- Main October dashboard remained: income Rp28.821.000, expenses Rp13.421.078, balance Rp15.399.922 and 8 transactions.
- Native confirmation remained above the blurred page at 320px; cancellation preserved records.
- A second browser tab showed an explicit read-only notice and disabled write controls, while the owning tab continued working.
- Mobile form focus placed the amount input within the central visible area, not at the bottom edge. Currency used dot thousands separators.
- Existing reduced-motion, chat/voice, bank import, tooltip and dashboard tests remain in the full regression suite.

Screenshots: `design-preview/financial-books/cicilan-desktop.png` and `design-preview/financial-books/simpanan-mobile.png`.

## Limitations and Deployment

The API was exercised using an isolated fake database driver, including parameterized SQL and atomic state/operation-ledger contracts. The browser used an in-memory fixture server. Actual Postgres execution and Netlify production persistence have not been verified in this change, and no production deployment was performed.

After an authorized deployment, the existing database driver and `APP_ACCESS_TOKEN` are required. First authenticated API use creates only `finance_special_books` and `finance_special_book_operations`; the ordinary transaction table is untouched. A separate test workspace should verify online create/edit/delete/reload before production adoption.

Installment totals are manually entered obligations, not automated interest schedules. Investment balances are recorded cash balances, not live market valuations. Existing daily-category records are not automatically copied to these separate books.

## Master Dashboard Alignment

The approved follow-up keeps the main dashboard as the design source. Summary markup now reuses `metric-card` and `metric-card-top`; history reuses `table-wrap` and `ledger-table`. Account details stay unframed. Existing IBM Plex Sans, type hierarchy, controls, focus treatment and semantic income/expense/balance colors are retained. Only page-specific background, accent, hover and selection tokens differ: blue for Cicilan and teal for Simpanan, in both themes. These distinctions identify the active book without creating a separate design system. No accounting, storage, backup or AI logic changed.

- 150 automated tests passed, 0 failed; build, changed JavaScript syntax and whitespace checks passed.
- Computed master and Cicilan summary cards match: IBM Plex Sans, 18px desktop padding, 8px radius and 25px number size at 1440px.
- Both pages and both themes were checked at 320, 390, 768 and 1440px. Document scroll width equalled client width; tested sibling layouts had no intersections and visible controls/numbers had no horizontal overflow.
- At 320px, summary cards use one column to avoid breaking currency amounts. Wider mobile uses a full-width primary total followed by two secondary cards.
- Mobile Simpanan entry form was opened and cancelled; its 44px amount field, heading and close control fit without overlap. Mobile menu navigation to Cicilan worked.
- Primary button text contrast: Cicilan light 6.70:1, Simpanan light 6.23:1, Cicilan dark 8.34:1, Simpanan dark 9.44:1.

Updated visual evidence: `design-preview/financial-books/cicilan-master-desktop.png`, `simpanan-master-desktop.png`, `cicilan-master-mobile.png`, and `master-layout-audit.json` in that same directory. Local fixture preview remains on port 4177. No commit, push or deployment was performed.
