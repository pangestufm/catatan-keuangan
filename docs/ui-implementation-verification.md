# Dashboard UI Verification

Verified locally on 2026-10-04. The implementation and preview stages made no
production deployment, credential change, or production financial-data modification.
Commit and push were authorized by the user after preview review.

## Preview

- http://127.0.0.1:4175/ runs the real frontend with synthetic transactions and a
  local fixture API. The visible test banner identifies simulated AI. Login uses
  the prefilled test workspace and fixture-only token.
- http://127.0.0.1:4176/ serves the actual static frontend without a fixture API.
  Local manual entry and backup operations work; hosted APIs are not available.
- Both servers are started by `node tests/preview-server.cjs`.

## Automated Checks

- `node --test --test-reporter=spec tests/*.test.cjs`: 63 passed, 0 failed.
- `node --check app.js` and `node --check dashboard-ui.js`: passed.
- `git diff --check`: passed; Git reports only normal LF-to-CRLF warnings.
- Independent read-only review reproduced two backup defects, both fixed with
  regression tests. The bounded recheck reported no findings and 47/47 passing.
- Coverage includes month/history filters, category totals and ledger filtering,
  exact Rupiah input, bank metadata after edits, CSV/Excel backup round trips,
  leading-zero and long numeric references, decimal amounts and serial dates,
  sync arriving during backup confirmation, chat/voice draft-before-save,
  permission/error recovery, duplicate submissions, bank reconciliation and
  confirmation cancellation. Existing Nexos and ten-page PDF tests also pass.

## Browser Checks

- Tested widths: 320, 390, 768, 820, 1024 and 1440 px, light and dark themes.
  Final checks found no page horizontal overflow or overflowing category/metric
  cards. Long names and a large synthetic amount were tested at 320 px.
- Desktop manual save, persistence after reload, chat draft without saving,
  category filtering, quarterly history and empty-month state were exercised.
- Mobile inline entry, detail dialog, search/date filters and bank review were
  checked. Desktop entry uses a top-layer dialog; the background remains visible
  with blur. Escape, focus restoration and keyboard tab navigation were checked.
- Synthetic bank upload returned new, duplicate and changed entries. Only the new
  entry was selected initially. Saving a reviewed change and addition, then
  uploading again, produced zero additional new entries.
- Native destructive confirmation was opened and cancelled in the browser.
  Positive deletion was tested only in the isolated automated harness.
- Final browser console check returned no error or warning entries.

## Mobile And Interaction Refinement

- Category totals now use four equal-size cells, two columns on phones. At 320 px
  each cell measured 140 x 80 px. Standard category amounts fit on one line.
- Phone charts use a 360 x 240 coordinate system and responsive aspect ratio;
  desktop retains 640 x 260. Daily summary values share the same baseline.
- Cards have restrained border/background hover states without transforms.
  Floating tooltips expose full amounts, period and category information. Their
  appearance does not resize charts: desktop chart height remained 381.34 px
  before and after showing a tooltip.
- Tooltips support mouseover, keyboard focus and taps on informational cards or
  chart points; Escape dismisses them. They remain hoverable, use safe text and
  are cleared when their source is removed or a modal opens.
- Nine interaction regressions were added. Mouseover/mouseout were exercised in
  jsdom; browser checks exercised focus/keyboard/tap paths and native popovers.
- Final light/dark layout checks covered 320, 390, 600, 768, 820, 844, 1024 and
  1440 px, with 844 x 390 landscape. No page/card horizontal overflow was found.
- New evidence: `mobile-categories-320-updated.jpg`,
  `mobile-chart-tooltip-updated.jpg`, `desktop-tooltip-updated.jpg` in the same
  screenshot directory. Earlier screenshots describe the initial implementation.

## Evidence

Desktop motion refinement: short, finite Web Animations API transitions now cover
initial metric cards, changed values, category cards/rails, chart lines/points,
ledger updates, dialogs, entry tabs, tooltips and toasts. Unchanged data does not
replay the animation. No counting animation changes the displayed monetary value.
Animations are disabled at <=900 px and with reduced motion, and cancelled when
switching to those settings. Dialogs remain immediately interactive and close
without waiting for animation completion. Six new regression tests pass.

Browser checks observed value opacity changing during a desktop period update,
daily line clip-path progressing from `inset(0px 100% 0px 0px)`, and an opening
dialog with input focus already active. At 390 px the same update retained
opacity 1 and clip-path none, with no page overflow. Reduced-motion behavior was
tested in the isolated harness; the operating system preference was not changed.

Screenshots are in `design-preview/implementation-2026-10-03/`:
`desktop-light.jpg`, `desktop-full-light.jpg`, `desktop-dark.jpg`,
`desktop-entry.jpg`, `mobile-categories-light.jpg`,
`mobile-categories-dark.jpg`, and `mobile-transactions.jpg`.

## Boundaries

Production preflight adds `npm run build` and publishes only the allowlisted
frontend files plus vendor assets from `dist/`. Local mockups, fixture servers,
tests, documentation, API source and repository metadata are excluded. Netlify
Functions retain their existing configuration. The production-output regression
verifies required assets match their source and internal files are absent.

Live Netlify database, real Nexos responses, physical microphone permission and
recognition, Safari/iOS rendering, and a real bank PDF were not exercised during
this implementation. Browser fixture responses do not prove external-service
availability. Existing production provider/database configuration is unchanged.
These checks cover the exercised paths; they are not a guarantee of zero defects
on every device or service condition.
