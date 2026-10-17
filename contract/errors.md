# Error taxonomy — client ⇄ backend

Every non-2xx response body is `{ code, message, retryable?, details? }`.
`code` is the **stable contract enum** below; `message` is human copy (localised
server-side by the request's `locale`); `retryable` tells the client whether a
blind retry could help; `details` is free-form diagnostic data.

The client branches on `code` **only** — never on HTTP status, never on message
text (`app/src/lib/backend/errors.js`).

| Code | HTTP | Retryable | Client behaviour |
|---|---|---|---|
| `invalid_request` | 400 (405 for a wrong method) | no | Bug or malformed input — show a generic "something's off", log. |
| `unknown_tenant` | 400 | no | `X-Tenant-Id` missing / unknown / inactive. Build-config bug — the client's `VITE_TENANT_ID` is wrong or the tenant is disabled server-side. **Degrade silently** (act as offline); log loudly. |
| `invalid_credentials` | 401 | no | Sign-in form: "email or password is wrong". |
| `email_in_use` | 409 | no | Sign-up form: offer sign-in instead. |
| `unauthorized` | 401 | no | **Degrade silently** — drop session, revert to signed-out/offline. |
| `session_expired` | 401 | no | **Degrade silently** — same as above. Never an error screen. |
| `no_credits` | 402 | no | Generation intake: route to the buy-credits screen. |
| `plus_required` | 402 | no | A Plus-only feature (cloud sync) without an active Plus. **Degrade silently**: the client shows a passive "available with Plus", never an error screen. The client branches on `code`, so sharing 402 with `no_credits` is safe. |
| `unknown_pack` | 400 | no | Refresh pack list; bug if it persists. |
| `invalid_intake` | 400 | no | Generation form: field-level errors from `details`. |
| `generation_failed` | 200 job / — | no | Retries exhausted. **User is not charged.** Show the plain failure copy; `details.validatorErrors` is for logs, not UI. |
| `rate_limited` | 429 | yes (after `details.retryAfter`) | Back off; show "try again in a moment". |
| `daily_ceiling_reached` | 429 | no (today) | Per-account daily generation cap. Show when it resets. |
| `sync_not_enabled` | 409 | no | Sync is off for this account — offer the toggle. |
| `no_snapshot` | 404 | no | Nothing pushed yet — treat as "cloud is empty", not an error. |
| `revision_mismatch` | 412 | yes (after merge) | Body carries the server snapshot; run union-by-session-id merge, re-PUT with the new `If-Match`. |
| `snapshot_too_large` | 413 | no | Payload over the server cap — surface a real message; rare. |
| `contract_version_unsupported` | 400 | no | `X-Contract-Version` names a major the server does not support. **Degrade silently** for account features; prompt "update the app" only where the user explicitly invoked a remote action. |
| `health_consent_required` | 400 | no | `constraintsText` was sent without `healthDataConsent: true` — client bug; the consent gate should make this unreachable. |
| `consent_required` | 400 | no | A checkout request arrived without an accepted express-consent record (`consent.accepted` is not `true`). Client bug — the purchase screen must not enable the buy action before the user ticks it. |
| `not_implemented` | 501 | no | The endpoint is in the contract but its handler is not built yet (the backend bootstrap answers every not-yet-built operation this way). **Degrade silently** — act as offline. |
| `provider_unavailable` | 502/503 | yes | LLM/payment provider is down. **Degrade silently** for background calls; "try again shortly" for a foreground generation. |
| `internal` | 500 | yes | Generic. Log with any request id from `details`. |
| `backend_unavailable` | — (client-only) | yes | No `VITE_BACKEND_URL`, offline, or transport failure. This is the **default state today**. Callers act as the offline free app. Never on the wire, so it is not in the OpenAPI `Error.code` enum. |

## Rules

1. **`unauthorized`, `session_expired`, `provider_unavailable`, `backend_unavailable`, `unknown_tenant`, `not_implemented` and `plus_required` are in `DEGRADE_SILENTLY`** — the app must be exactly as usable as if the account never existed. No error screen, no toast, no nag. (`unknown_tenant` also gets a loud console log — it's a build-config bug, not a user situation. `plus_required` is shown only as a passive "available with Plus".)
2. **`generation_failed` ⇒ the credit is refunded server-side automatically** before the job reaches terminal state. The client shows failure copy and offers a retry that costs a (refunded) credit only when the user acts.
3. **`details` never contains PII or secrets.** Validator error lists (equipment ids, field paths) are fine; user free-text, tokens, provider keys are not.
4. New codes are a **contract change** — add here, bump `openapi.yaml` `info.version`, add the value to the OpenAPI `Error.code` enum and to `types.d.ts`, add it to the client's `errors.js` if it changes behaviour, and log it in `CHANGELOG.md`. The three lists (this table, the enum, `types.d.ts`) are kept identical, with `backend_unavailable` the one client-only exception; the contract lint fails otherwise.
