# contract/ — the client ⇄ backend contract

The single source of truth for what the public PWA (`gym-rutina/basic-fit`) and
the private multi-tenant backend (`gym-rutina/backend`, not built yet — nothing is deployed) say to each other. It
lives in the **public** repo; the backend is to vendor it with `git subtree`.

| File | What it is |
|---|---|
| `openapi.yaml` | The HTTP contract (OpenAPI 3.1). `info.version` is the contract version. |
| `errors.md` | The closed error-code taxonomy both sides branch on. |
| `types.d.ts` | TypeScript mirror of the wire shapes (hand-maintained). |
| `CHANGELOG.md` | One entry per contract version. |
| `rutina-core/` | **Generated** copy of the shared rutina validator + its JSON schema (see below). Do not edit by hand. |

Nothing in here is a secret, a credential or a live URL. `servers:` in
`openapi.yaml` is a placeholder host that cannot resolve.

## Versioning (SemVer)

`openapi.yaml` `info.version` follows SemVer and every change is logged in
`CHANGELOG.md`:

- **PATCH** — wording, descriptions, examples; no shape change.
- **MINOR** — backwards-compatible: a new endpoint, a new optional field, a new
  error code, refining an operation marked `x-status: draft`.
- **MAJOR** — anything an existing client or server would break on: removing or
  renaming an endpoint or field, tightening a request shape, changing the
  meaning of a code.

The client sends **`X-Contract-Version: <major>`** on every request (today `0`).
A server that does not support that major answers **`contract_version_unsupported`**
(HTTP 400, see `errors.md`); the client degrades silently for account features and
only asks the user to update the app where they explicitly invoked a remote action.

New error codes are a contract change: add the row to `errors.md`, the value to
the `Error.code` enum in `openapi.yaml` and to `types.d.ts`, then bump the version.

## Order of a cross-cutting change

1. **Public repo first.** Change `contract/` (and the client code that consumes
   it) in a pull request to `gym-rutina/basic-fit`. The contract tests in
   `scripts/contract/` must pass: the OpenAPI file parses, every `$ref`
   resolves, the three error-code lists agree, the shipped report builder
   conforms to `ClubEquipmentReport`, and `rutina-core/` is not stale.
2. **Then the backend pulls it** with `git subtree pull` (below) and adapts its
   handlers; the backend's own tests assert that its responses and its accepted
   request bodies match the vendored contract.
3. The backend never edits `contract/` in its own tree; a change needed there
   starts at step 1.

## How the backend vendors `contract/` (git subtree)

A subtree of a *subdirectory* needs a split branch: pulling the repo's `main`
would vendor the whole client under `contract/`. So the public repo publishes a
branch that contains **only** `contract/`:

```bash
# in the public repo, after the contract change is committed
git subtree split --prefix=contract -b contract-dist
git log --oneline -1 contract-dist        # record this hash in the backend PR

# in the backend repo — first time (the public commits may not be pushed yet,
# so the first add can use a local path)
git subtree add --prefix contract <path-to-the-public-repo> contract-dist --squash

# in the backend repo — every later bump, from the pushed public repo
git subtree pull --prefix contract https://github.com/gym-rutina/basic-fit contract-dist --squash
```

## `rutina-core/` — one validator, never a fork

The backend validates generated rutinas with the **same** validator the client
ships (`scripts/lib/rutina-validator.js` + `data/schema/rutina.schema.json`).
Those files live outside `contract/`, so a subtree split would not carry them.
`scripts/build-contract.js` therefore emits a copy under `contract/rutina-core/`:

```bash
npm run build:contract      # regenerates contract/rutina-core/
```

The validator is byte-identical to the original except for the one `require`
that points at the schema (it sits next to the validator in the copy). A vitest
drift test regenerates the copy in memory and fails if the committed files differ,
so after changing the validator or the schema, run `npm run build:contract` and
commit the result. The generator uses only `fs` and `path`: it adds no dependency.
