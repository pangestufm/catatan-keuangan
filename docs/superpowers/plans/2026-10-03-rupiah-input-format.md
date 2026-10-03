# Rupiah Input Formatting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Accept every positive whole-Rupiah value and display dot thousand separators in all editable amount fields.

**Architecture:** Add a small UMD helper module that converts between display strings and integer Rupiah values. Static manual and AI-draft fields bind to the helper directly; dynamic bank-review fields use the existing delegated event handler. Application state, API data, and exports remain numeric.

**Tech Stack:** Vanilla JavaScript, HTML, Node.js built-in test runner.

## Global Constraints

- Editable amount `5012278` must display as `5.012.278`.
- Rp5.012.278 must save as integer `5012278`.
- No money input may enforce `step="100"`.
- Only positive whole Rupiah values are supported.
- CSV/XLS numeric values and database payloads must remain unformatted numbers.

---

### Task 1: Currency formatting helper

**Files:**
- Create: `currency-input.js`
- Create: `tests/currency-input.test.cjs`

**Interfaces:**
- Produces: `formatRupiahInput(value)`, `parseRupiahInput(value)`, and `formatElement(input)` through `module.exports` and `window.CurrencyInput`.

- [ ] **Step 1: Write failing helper tests**

Test these exact contracts:

```js
assert.equal(formatRupiahInput("5012278"), "5.012.278");
assert.equal(formatRupiahInput("Rp 5.012.278"), "5.012.278");
assert.equal(parseRupiahInput("5.012.278"), 5012278);
assert.equal(parseRupiahInput(""), 0);
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `node --test tests/currency-input.test.cjs`

Expected: FAIL because `currency-input.js` does not exist.

- [ ] **Step 3: Implement minimal UMD helper**

Strip every non-digit, remove redundant leading zeroes, group digits from the right in blocks of three, and return numeric zero for empty values. `formatElement` replaces the field value and restores the caret based on how many digits were before the previous caret.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `node --test tests/currency-input.test.cjs`

Expected: all helper tests pass.

### Task 2: Integrate all amount inputs

**Files:**
- Modify: `index.html`
- Modify: `app.js`
- Modify: `tests/currency-input.test.cjs`

**Interfaces:**
- Consumes: `window.CurrencyInput`.
- Produces: formatted manual, agent-draft, and bank-review values while storing numbers.

- [ ] **Step 1: Add failing integration assertions**

Assert that `index.html` loads `currency-input.js` before `app.js`, manual and draft amounts use `type="text" inputmode="numeric"`, bank amount markup does the same, and source code contains no `step="100"` amount field.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `node --test tests/currency-input.test.cjs`

Expected: FAIL on the current native number inputs.

- [ ] **Step 3: Wire formatting and parsing**

Load the helper before `app.js`. Bind static field `input` events, format values populated by `showDraft()` and `fillForm()`, parse values in `handleSubmit()` and `confirmDraftTransaction()`, and format/parse bank-review values through `handleBankImportDraftChange()`.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `node --test tests/currency-input.test.cjs`

Expected: all currency tests pass.

### Task 3: Verify and deploy

**Files:**
- Verify all changed source and test files.

- [ ] **Step 1: Run full tests and syntax checks**

Run: `npm test`, `node --check currency-input.js`, `node --check app.js`, and `git diff --check`.

Expected: all commands exit 0.

- [ ] **Step 2: Commit and push**

Commit the helper, integrations, tests, and plan, then push `main` to `origin`.

- [ ] **Step 3: Verify Netlify production**

Wait for the production deploy matching the pushed commit. Fetch live `index.html`, `currency-input.js`, and `app.js`; verify formatted-input contracts are present and legacy `step="100"` inputs are absent.
