# Nexos Chat and Voice Design

## Goal

Use Nexos as the only AI provider for quick transaction entry from typed chat and browser-transcribed voice, while retaining the local parser only as a resilience fallback.

## User Flow

1. The user types a transaction or records speech in the existing quick-entry panel.
2. Browser speech recognition converts voice to text using the existing UI flow.
3. The app sends the text, current date, timezone, category list, learned category memory, and recent transactions to `/.netlify/functions/parse-transaction`.
4. The function asks Nexos model `NEXOS_MODEL` (default `DeepSeek V4.1 Flash`) to return one structured transaction draft.
5. The app presents the draft for review before it is saved. If Nexos is unavailable or returns an invalid draft, the existing local parser remains available as fallback.

## Backend Contract

- Endpoint: `POST https://api.nexos.ai/v1/chat/completions`
- Authentication: `Authorization: Bearer ${NEXOS_API_KEY}`
- Model: `NEXOS_MODEL`, defaulting to `DeepSeek V4.1 Flash`
- Response format: JSON object with `type`, `date`, `category`, `description`, `amount`, `confidence`, and `reason`
- Function response: `{ provider: "nexos", model, transaction }`
- Gemini/OpenAI selection and credentials are no longer used by this function.

## Frontend Contract

- Drafts returned by the function are labeled `Nexos Agent`.
- The confirmation copy identifies the source as `agent Nexos`.
- The local parser still labels its own results as `parser lokal`.

## Reliability And Security

- The Nexos API key remains server-side in Netlify environment variables.
- Client requests never receive or transmit the API key.
- Empty transaction text is rejected before calling Nexos.
- Invalid upstream JSON and upstream API failures return a controlled parser error.
- Existing authentication via `APP_ACCESS_TOKEN` remains unchanged.

## Verification

- Automated tests verify endpoint, bearer authentication, default/custom model, contextual prompt, JSON parsing, and missing-key behavior.
- Existing bank-import and document tests must remain green.
- A production smoke test calls the deployed parser with a sample Indonesian transaction and confirms `provider: "nexos"` plus a valid categorized draft.
