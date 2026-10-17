# Contract changelog

SemVer on `openapi.yaml` `info.version`. Every entry = one PR to the public
client repo (`gym-rutina/basic-fit`), followed by the backend repo
(`gym-rutina/backend`) pulling the `contract/` subtree to that commit (see
`README.md` — cross-repo change protocol).

## 0.3.0 — 2026-10-17 — backend bootstrap

- **`ClubEquipmentReport` shrinks to exactly the six fields the shipped client
  already sends:** `reportId` (UUID), `clubId`, `equipmentId`, `signal`
  (`present` | `absent`), `method` (`session` | `catalog`), `reportedAt`. It is
  `additionalProperties: false`. The fields **`note`**,
  **`substituteEquipmentId`** and **`catalogueVersion`** are **removed**
  (privacy: nothing that identifies a person or a device).
- **Privacy statement on `POST /v1/club-equipment/reports`:** the collector
  persists no IP address, no user agent and no fingerprint (nor any hash or
  truncation of them); abuse limiting is in-memory only.
- **New subscription endpoints (draft):** `GET /v1/subscription`,
  `POST /v1/subscription/checkout` (selects `plus` or `pack`, carries locale and
  the express-consent record `{version, accepted}`, returns a hosted-checkout
  URL), `POST /v1/subscription/portal` (returns a portal URL).
  `POST /v1/credits/checkout` stays for packs.
- **New withdrawal endpoint (draft):** `POST /v1/withdrawals` (declaration +
  purchase reference → acknowledgement).
- **Webhook renamed:** `POST /v1/webhooks/lemonsqueezy` → **`POST
  /v1/webhooks/stripe`** (Stripe direct is decided). It takes no `X-Tenant-Id`:
  the tenant comes from the verified event.
- **Three new error codes:** **`not_implemented`** (501, degrade silently),
  **`consent_required`** (400), **`plus_required`** (402, degrade silently — a
  passive "available with Plus"). Sync operations may answer `plus_required`.
- **`Error.code` is now an enum** in `openapi.yaml` (it was a free string),
  identical to `errors.md` and `types.d.ts` minus the client-only
  `backend_unavailable`. `unknown_pack`, listed in `errors.md` but missing from
  `types.d.ts`, is reconciled.
- **`GET /v1/health`:** `required` is now `[status, contractVersion]`;
  `equipmentCatalogueVersion` is `null` without a valid tenant. Health is
  tenant-agnostic and never fails on a bad tenant.
- **`GET /v1/tenant/config`** gains `plans` (grant sizes only: `plus.creditsPerPeriod`,
  `plus.subscriptionCreditCap`, `pack.credits` — never a price id) and requires
  `displayName`.
- **`X-Tenant-Id` / `X-Contract-Version`** are declared per path
  (`components.parameters`) instead of only described in prose.
- **`servers`** is a placeholder host that cannot resolve; nothing is deployed.
- **`rutina-core/`** (generated copy of the shared rutina validator and its
  schema, `npm run build:contract`) now ships alongside the contract.
- `types.d.ts` carries the wire types only; the client-side `BackendClient`
  interface lives in the client repo.

## 0.2.0 — 2026-08-28 — white-label / multi-tenant

- **`X-Tenant-Id` header now required on every endpoint** (components.parameters
  TenantId). Backend scopes all data by tenant; `basicfit` is tenant #1.
- New error code **`unknown_tenant`** (400) — in the degrade-silently set.
- New endpoint **`GET /v1/tenant/config`** — per-tenant catalogue version +
  supported generation output locales.
- `/v1/health` `equipmentCatalogueVersion` note updated: it's per-tenant,
  resolved from `X-Tenant-Id`.

## 0.1.0 — 2026-08-28

Initial contract. Endpoints for account, generation, credits/checkout + provider
webhook, sync, plus the club-equipment collector. Error taxonomy in `errors.md`.

- Payment provider left out of the contract on purpose — `checkoutUrl` is
  opaque, so Stripe-direct vs Lemon Squeezy does not change the client
  contract, only the `/v1/webhooks/*` handler name.
- LLM provider likewise absent — `/v1/generations` is provider-agnostic;
  OpenRouter vs direct OpenAI is a backend detail.
