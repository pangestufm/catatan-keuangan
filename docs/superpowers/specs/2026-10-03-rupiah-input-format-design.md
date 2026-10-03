# Rupiah Input Formatting Design

## Goal

Accept every positive whole-Rupiah amount, including values that are not multiples of 100, and show dot thousand separators in every editable money field.

## Scope

The behavior applies to:

- Manual transaction amount input.
- Chat and voice draft amount input.
- Bank-statement review amount inputs.
- Amounts populated when editing an existing transaction or moving an AI draft to the manual form.

Existing cards, summaries, transaction tables, tooltips, and notifications continue using the current Indonesian Rupiah formatter. CSV and XLS exports continue storing numeric cells without display separators so calculations and backup imports remain reliable.

## Input Behavior

- Money fields use text inputs with `inputmode="numeric"` rather than native number inputs.
- Typing `5012278` displays `5.012.278` immediately.
- Pasting `Rp 5.012.278` produces `5.012.278`.
- Only decimal digits are retained; decimal fractions and negative amounts are not supported.
- Empty fields remain empty while editing. A value must parse to an integer greater than zero before saving.
- The native `step="100"` constraint is removed, so Rp5.012.278 is valid.

## Data Flow

1. An input listener strips non-digits from the edited value.
2. The resulting digit string is formatted with Indonesian dot thousand separators for display.
3. Submit and draft-review handlers parse the formatted string back to a whole integer.
4. Application state, database payloads, reconciliation fingerprints, and export rows continue receiving numbers.

## Components

- `formatRupiahInput(value)` converts a number or numeric string into a dot-separated display string.
- `parseRupiahInput(value)` strips display separators and returns a positive whole number or zero.
- `bindCurrencyInput(input)` applies formatting on `input` and normalizes programmatically populated values.
- Dynamically rendered bank-review fields use event delegation and the same helpers.

## Validation And Errors

- Manual and AI draft forms keep their existing required-field checks.
- Bank-review rows remain invalid if their parsed amount is zero.
- No browser step-mismatch popup is possible because the fields no longer use `type="number"` or `step`.

## Testing

- Unit tests cover formatting `5012278` as `5.012.278`, parsing the formatted result back to `5012278`, pasted currency text, empty input, and exact-Rupiah values.
- Static integration tests verify all three money-entry surfaces use the currency-input contract and contain no `step="100"` amount fields.
- Existing agent, bank reconciliation, import, and PDF tests must remain green.
- Production verification edits or creates a transaction with Rp5.012.278 and confirms the live input displays `5.012.278` without native validation errors.
