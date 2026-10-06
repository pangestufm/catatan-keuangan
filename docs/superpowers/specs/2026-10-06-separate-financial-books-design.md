# Separate Financial Books

Approved by the user on 2026-10-06: installments and savings/investments/deposits must have separate pages and separate accounting, without changing the main dashboard. Apply antislop during implementation; retain the existing IBM Plex Sans, neutral surfaces, green action accent, Lucide icons and responsive navigation.

## Data and Accounting

- Accounts: `id`, `kind` (installment, savings, investment, deposit), `name`, `startDate`, `totalAmount` (installment only), `openingBalance` (other accounts), `notes`.
- Entries: `id`, `accountId`, `kind` (payment, deposit, withdrawal), `date`, `amount`, `description`.
- Installment totals are manually supplied contractual obligations, not inferred principal or interest schedules. Remaining obligation equals total minus recorded payments. Opening an obligation is not a payment.
- Savings balances are historical cash balances, not live market valuations. Opening balance plus deposits minus withdrawals. Withdrawal cannot make the chronological balance negative. Entries cannot precede account start date.
- All monetary amounts are whole nonnegative Rupiah, entries strictly positive, displayed with dot thousands separators. Validate safe integers, real dates and references on client and server.
- No automatic migration, linking, or copying from ordinary dashboard categories. Existing records stay unchanged. No AI categorization is needed for these dedicated forms.

## Pages

`#cicilan` and `#simpanan` are actual independently navigable views inside the existing app shell. Both appear in the left burger menu and compact main navigation. Main dashboard sections and floating transaction buttons are hidden on these views; the ordinary Catat route always returns to dashboard before opening its original form.

Each page contains lifetime summary metrics, account list, add/edit account form, selected-account detail, and add/edit dated entry form. Account details have their own month filter, independent from lifetime balance and ordinary dashboard month. Delete actions require confirmation. Deleting an account warns that its associated entries will also be removed. Loading, offline, error and empty states are explicit. Keyboard focus and browser back/forward navigation must work.

## Persistence and Backup

Use a dedicated authenticated Netlify Function `financial-books`, with a dedicated Postgres table and workspace key. Reuse the existing database driver; do not change main transaction storage or AI configuration. Mutations use optimistic revisions and durable local operation queues. A conflicting revision triggers a refetch and revalidation, never an unconditional full snapshot overwrite. Async results cannot cross workspace/logout boundaries. Failed sync is visible and retryable, while local data remains available.

Persist accepted operation IDs in a separate durable ledger, atomically with the state update. The bounded recent-ID response is not the sole retry safeguard. GET can reconcile requested pending IDs in bounded batches. Browser Web Locks permit one writing tab per workspace; other tabs remain read-only with an explicit notice. A cache-change check protects browsers without Web Locks. Open forms and delete confirmations reject changes if the referenced records/history have changed since opening. Discard blocks new mutations while fetching the replacement snapshot.

Dedicated CSV/Excel backups carry tagged account/entry rows with stable IDs. Global backup exports include these rows or a separate workbook sheet. Restore is additive and confirmation-first: preserve existing data, skip duplicate IDs and explicitly report changed IDs rather than overwrite them. Special rows must never be interpreted as daily transactions. Unsupported or invalid backup records reject the special-book restore.

## Verification

Test totals, date/reference validation, overpayment/overdraw rejection, CRUD, deletion confirmation, workspace isolation, authentication, optimistic conflicts, duplicate retry, offline queue recovery, CSV/Excel roundtrip, duplicate restores, and unchanged main dashboard/AI workflows. Check desktop/mobile, light/dark, keyboard and reduced motion. Provide local preview; do not push or modify production data until explicitly requested.
