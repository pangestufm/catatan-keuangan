# Nexos Chat and Voice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Nexos DeepSeek V4.1 Flash the only AI agent used to parse transaction chat and voice input.

**Architecture:** The browser keeps its existing voice-to-text and draft-review flow. The `parse-transaction` Netlify function becomes a single-provider Nexos adapter that sends user context to Nexos' OpenAI-compatible chat-completions endpoint and returns a sanitized transaction draft. The local browser parser remains a failure fallback.

**Tech Stack:** Vanilla JavaScript, Netlify Functions, Node.js built-in test runner, Nexos Chat Completions API.

## Global Constraints

- Use `NEXOS_API_KEY` and optional `NEXOS_MODEL` only for AI parsing.
- Default model is exactly `DeepSeek V4.1 Flash`.
- Preserve the existing request authentication and draft confirmation flow.
- Do not expose AI credentials to browser code.
- Preserve all existing bank-statement import behavior and tests.

---

### Task 1: Nexos transaction parser contract

**Files:**
- Create: `tests/parse-transaction.test.cjs`
- Modify: `netlify/functions/parse-transaction.js`

**Interfaces:**
- Consumes: JSON request fields `text`, `today`, `timezone`, `categories`, `categoryMemory`, and `recentTransactions`.
- Produces: JSON `{ provider: "nexos", model: string, transaction: object }`.

- [ ] **Step 1: Write failing endpoint and model tests**

Create tests that stub `global.fetch`, call `handler`, and assert:

```js
assert.equal(url, "https://api.nexos.ai/v1/chat/completions");
assert.equal(options.headers.Authorization, "Bearer test-nexos-key");
assert.equal(request.model, "DeepSeek V4.1 Flash");
assert.deepEqual(request.response_format, { type: "json_object" });
assert.equal(body.provider, "nexos");
```

Also assert a configured `NEXOS_MODEL` overrides the default and a missing key returns status `503` without calling fetch.

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test tests/parse-transaction.test.cjs`

Expected: FAIL because the current function calls Gemini/OpenAI and does not return Nexos model metadata.

- [ ] **Step 3: Implement the Nexos-only adapter**

Replace provider selection with these constants and one call path:

```js
const NEXOS_API_URL = "https://api.nexos.ai/v1/chat/completions";
const DEFAULT_NEXOS_MODEL = "DeepSeek V4.1 Flash";
```

Build a Nexos request with system instructions, contextual JSON in the user message, low temperature, and `response_format: { type: "json_object" }`. Parse `choices[0].message.content`, sanitize the transaction, and return provider/model metadata. Return `503` when `NEXOS_API_KEY` is absent.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `node --test tests/parse-transaction.test.cjs`

Expected: all transaction-parser tests pass.

### Task 2: Nexos source labeling and documentation

**Files:**
- Modify: `app.js`
- Modify: `README.md`

**Interfaces:**
- Consumes: function response `provider: "nexos"`.
- Produces: draft source `Nexos Agent` and confirmation label `agent Nexos`.

- [ ] **Step 1: Add failing static contract assertions**

Extend `tests/parse-transaction.test.cjs` to read `app.js` and `README.md` and assert that the UI contains `Nexos Agent`, legacy agent labels are absent, and docs describe `NEXOS_API_KEY`/`NEXOS_MODEL` without `AI_PROVIDER`, `GEMINI_API_KEY`, or `OPENAI_API_KEY`.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `node --test tests/parse-transaction.test.cjs`

Expected: FAIL on current Gemini/ChatGPT labels and legacy README settings.

- [ ] **Step 3: Update UI labels and setup documentation**

Set normalized AI drafts to:

```js
source: provider === "nexos" ? "Nexos Agent" : "Nexos Agent"
```

Map `Nexos Agent` to `agent Nexos`, and document one shared Nexos configuration for chat, voice, and bank statement import.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `node --test tests/parse-transaction.test.cjs`

Expected: all focused tests pass.

### Task 3: Full verification and deployment

**Files:**
- Verify: all modified source, test, and documentation files.

**Interfaces:**
- Consumes: completed working tree.
- Produces: tested Git commit, pushed branch, and verified production function.

- [ ] **Step 1: Run all automated tests**

Run: `npm test`

Expected: all tests pass with zero failures.

- [ ] **Step 2: Run syntax checks and inspect diff**

Run: `node --check netlify/functions/parse-transaction.js`, `node --check netlify/functions/parse-bank-statement.js`, `node --check app.js`, and `git diff --check`.

Expected: every command exits with code 0.

- [ ] **Step 3: Commit implementation**

Stage the intended Nexos chat/voice changes together with the pending PDF reliability changes, then commit with a descriptive message.

- [ ] **Step 4: Push and verify Netlify production**

Push `main`, wait for Netlify production deploy to become ready, then POST a sample Indonesian transaction to `/.netlify/functions/parse-transaction`. Confirm HTTP 200, `provider: "nexos"`, model `DeepSeek V4.1 Flash`, and a valid categorized draft.
