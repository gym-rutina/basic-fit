# Backup Format Reference

This document specifies the **full-data backup** file — a complete, restorable snapshot of
one device's user state, written by the PWA's **Settings → Copia de seguridad** section and
read back by the restore flow. It is a different artifact from the
[LLM progress export](export-format.md); see [The two exports](#the-two-exports) below.

The format is also the wire payload that a future sync backend
(`cloud-account-llm-rutina`) will POST and validate — field names, versioning and
semantics are chosen with that in mind, so third-party readers can rely on this document
rather than the source.

**Source:** `app/src/lib/backupFormat.js` (`buildBackup`, `parseBackup`,
`reconcileLastWeights`, `CURRENT_FORMAT_VERSION`), `app/src/lib/settingsRegistry.js`
(the settings allowlist), `app/src/lib/db.js` (`readAllForBackup`, `restoreFromBackup`),
`data/schema/backup.schema.json` (the envelope JSON Schema).

**Filename:** `rutina-backup-YYYY-MM-DD.json` — deterministic, sorted-friendly, and chosen
so it never collides with the LLM export's `rutina-progreso-YYYY-MM-DD.json`.

---

## The two exports

The PWA writes two unrelated JSON files. They exist for opposite reasons and neither can
stand in for the other.

| | **Progress export** ([`export-format.md`](export-format.md)) | **Full-data backup** (this document) |
|---|---|---|
| Entry point | History → **Exportar progreso** (`/export`) | Settings → **Copia de seguridad** → *Descargar copia completa*; also **Restaurar copia…** on the empty Import screen |
| Filename | `rutina-progreso-YYYY-MM-DD.json` | `rutina-backup-YYYY-MM-DD.json` |
| Contents | Per-exercise weight/difficulty log, keyed by [exercise key](export-format.md#exercise-key) | Rutina library, active pointer, **every** session with full detail, working weights, app settings |
| Lossy? | **Yes, on purpose** — drops the rutina, session ids, statuses, timestamps, `dayIndex`, abandoned-session detail, and every setting | **No** — sufficient to reconstruct the app's full user state on a clean install |
| Readable by a human / an LLM? | Yes — that is its whole job | It is machine-oriented; readable but not designed for pasting into a chat |
| Re-importable? | **No** — there is no import path for it | **Yes** — that is its whole job |
| Shareable (`navigator.share`)? | Yes | **No — download only.** The file can carry a bearer capability (see [Settings block](#datasettings--localstorage-settings)) |

If you want to move your training history to a new phone, or guard against a browser
clearing its storage, use the **backup**. If you want an LLM to see how your last phase
went so it can write the next one, use the **progress export**.

---

## Why the backup exists

PWA storage is **not permanent**. A browser "clear site data", a new phone, switching
from Chrome to Safari, or an iOS PWA evicted after roughly 7 days of non-use all wipe the
local database with no warning and no recourse. Everything the app knows about a user
lives in one browser's IndexedDB and `localStorage`; the backup is the only way to get it
out and the only way to get it back.

---

## Envelope

```json
{
  "formatVersion": 1,
  "appVersion": "1.17.2",
  "exportedAt": "2026-09-09T11:26:00.000Z",
  "data": {
    "rutinas": [ … ],
    "activeRutinaId": "…" ,
    "sessions": [ … ],
    "lastWeights": [ … ],
    "settings": { … }
  }
}
```

| Field | Type | Notes |
|---|---|---|
| `formatVersion` | integer ≥ 1 | Currently **1**. Governs restore compatibility — see [Versioning rules](#versioning-rules). |
| `appVersion` | string | The `package.json` `version` of the app that wrote the file. **Informational only** — it is not used to accept or reject a restore. |
| `exportedAt` | ISO 8601 string | Timestamp of export. This is the **only** field that differs between two consecutive exports of an unchanged state. |
| `data` | object | The payload. Every sub-section below. |

Unknown fields at the envelope level and inside `data` are **ignored, never fatal**
(`backup.schema.json` sets `additionalProperties: true` at both levels) — this is what
lets a file written by a newer app with the *same* `formatVersion` still restore. See
[Versioning rules](#versioning-rules).

---

## `data.rutinas[]` — the rutina library

Every entry from the IndexedDB `rutinas` store, verbatim, ordered by `seq`.

```json
{
  "id": "b7c4…",
  "rutina": { "meta": { … }, "program": { … }, "days": [ … ] },
  "importedAt": "2026-08-14T09:03:11.000Z",
  "seq": 2
}
```

| Field | Notes |
|---|---|
| `id` | Stable library-entry id (UUID). This is what `activeRutinaId` points at. |
| `rutina` | The rutina payload as imported. On restore it is **re-validated** against `data/equipment.json` through the same `validateImportedRutina` gate the Import screen uses — see [Restore contract](#restore-contract). |
| `importedAt` | ISO timestamp the entry was added to the library. |
| `seq` | Monotonic insertion counter. Preserves library order independently of the UUID keys. |

## `data.activeRutinaId`

The `id` of the active library entry, or `null` when nothing is active (an empty
library). On restore this becomes `activeRutina.current = { key: 'current', rutinaId: <id> }`;
a `null` value writes no pointer.

## `data.sessions[]`

Every session from the IndexedDB `sessions` store — **all statuses** (completed, abandoned,
and any in progress at export time), each with its full `exercises[]` detail: `weightUsed`,
`difficulty`, `completedAt`, `dayIndex`, `rutinaId`, and the program-attribution snapshot.
Written back verbatim on restore. Every entry has at least an `id`.

## `data.lastWeights[]`

The per-exercise working-weight store (what the Active-session screen pre-fills).

```json
{ "exerciseKey": "g3-s10::prensa-de-pecho", "weight": 32, "loggedAt": "2026-08-20T18:40:00.000Z", "equipmentId": "g3-s10", "name": "Prensa de Pecho" }
```

It is included in the file for completeness and debuggability, **but it is not trusted on
restore.** `db.js` `restoreFromBackup` throws the file's `lastWeights` away and recomputes
the store from the restored `sessions` — see [`lastWeights` is always recomputed](#lastweights-is-always-recomputed).
`exerciseKey` and `weight` are required on each entry; `loggedAt`, `equipmentId` and
`name` are informational.

## `data.settings` — localStorage settings

An object keyed by the **real `localStorage` key**, with the raw stored string as the
value:

```json
{
  "rutina:onboardingSeen": "1",
  "rutina:uiLang": "es",
  "rutina:club": "{\"country\":\"ES\",\"city\":\"Málaga\",\"id\":\"1ec4…\"}",
  "rutina:clubInviteUrl": "https://invite.basic-fit.com/…"
}
```

Only these **six allowlisted keys** are ever written to the file. The list lives in
`app/src/lib/settingsRegistry.js` and is built by *importing* each key constant from its
storage module — it is an **allowlist, not a denylist**:

| Key | Holds |
|---|---|
| `rutina:onboardingSeen` | Whether the first-run onboarding carousel has been completed |
| `rutina:uiLang` | UI language (`es` / `en` / `be` / `fr` / `nl` / `de`) |
| `rutina:clubInviteUrl` | Saved Basic-Fit friend-invite link — **a bearer capability**, see below |
| `rutina:club` | Selected club (country / city / club id) |
| `rutina:libraryNoticeSeen` | Whether the one-time "Mis rutinas" migration notice has been dismissed |
| `rutina:promptRequest` | The onboarding answers used to compose the LLM prompt |

On restore, any key in the file that is **not** on this allowlist is ignored. Keys that
are present are written back verbatim; a per-key write failure (quota, private-mode
storage) is swallowed and loses just that one setting — it never aborts the restore.

**Why an allowlist.** A denylist ("back up everything except…") would silently sweep in
every future `localStorage` key — including anything session- or token-shaped that a later
feature adds. The allowlist means a new sensitive key is simply *never added* to it, so
the backup structurally cannot carry credentials, tokens, or account identifiers
(see [Guarantees](#guarantees)).

### Bearer-capability warning

If `rutina:clubInviteUrl` is set, the backup file contains a link that opens your club's
access QR code. **Anyone who opens the file can enter your gym.** The Settings section
states this in plain language before you download, and the file should be treated like a
key. This disclosure is not tied to the deferred encryption decision — it ships whenever
the invite link does.

---

## Versioning rules

Checked by `parseBackup` in this order; the first failure wins and **nothing is written**:

| Condition | Outcome |
|---|---|
| Not valid JSON | Rejected — `invalid-json`. |
| Not an object, or `formatVersion` is not an integer | Rejected — `invalid-schema`. |
| `formatVersion` **greater** than the app understands (`> 1` today) | Rejected — `newer-version`. The user is told to **update the app and try again**. Never partially applied. |
| `formatVersion` **lower** than current, but known | Migrated forward by `migrate()` (an identity step today, the seam for future migrations), then restored. |
| Envelope fails the `backup.schema.json` shape check | Rejected — `invalid-schema`. |
| Any `data.rutinas[i].rutina` fails `validateImportedRutina` | Rejected — `invalid-rutina`, carrying the **first** validation error. The whole restore is cancelled. |
| Unknown fields within an accepted `formatVersion` | **Ignored.** Not an error. |

The four rejection kinds (`invalid-json`, `invalid-schema`, `newer-version`,
`invalid-rutina`) each map to a specific, actionable message in the restore sheet.

---

## Restore contract

### Atomic — all or nothing

`db.js` `restoreFromBackup` runs inside **one** `withDb` call and **one** `readwrite`
IndexedDB transaction spanning all four user-data stores
(`rutinas`, `activeRutina`, `sessions`, `lastWeights`). The sequence is: clear all four
stores → write `rutinas` → write the active pointer → write `sessions` → write the
recomputed `lastWeights` → commit.

Any error between the first `clear()` and the commit is caught, the transaction is
**explicitly aborted**, and the error is re-thrown. A mid-restore failure therefore leaves
the previous local data **byte-identical** — never a half-replaced database. (A naive
single transaction *without* the explicit abort would commit the writes that already ran;
the abort is load-bearing.)

### Settings are written after the database

`localStorage` cannot join an IndexedDB transaction, so `settingsRegistry.writeAllSettings`
runs **only after** the database transaction has committed. It never throws: if a setting
fails to persist, that one key is lost silently and the restore still counts as done —
the database, the load-bearing part, is already safe. Ordering is deliberate: database
first (fail ⇒ abort, nothing changed), settings second (fail ⇒ degrade, database already
restored).

### `lastWeights` is always recomputed

The restore ignores `data.lastWeights` from the file and rebuilds the store from the
restored `sessions`, using the exact predicate `saveSession` uses
(`weightUsed != null && completedAt`), with the latest `completedAt` winning per
[exercise key](export-format.md#exercise-key). Rationale (spec AC8): *a backup can never
restore a working weight that the session history does not justify.* If the file's
`lastWeights` disagrees with its own sessions, the sessions win.

### Restore replaces — it does not merge

Restore is **wholesale replacement**. It clears the rutina library, the active pointer,
all sessions and all working weights, then writes what the file contains. When local data
exists, the confirmation sheet names the concrete loss ("Se BORRARÁ lo actual de este
dispositivo: 34 sesiones y 2 rutinas") and requires an explicit confirm; restoring onto an
empty install skips that warning. There is no partial or selective restore, and no
merge of two histories — both are deferred.

### After a successful restore

The app calls `window.location.reload()`. The UI language and the onboarding flag are read
once at startup, so only a full reload re-initialises them against the just-restored data.

---

## Guarantees

- **No credentials, tokens, or account identifiers** — ever. The settings block is an
  allowlist of six known keys; there is nothing else it can carry. (Stated so it stays
  true when an account feature is added later — a session token must never be added to
  the allowlist.)
- **Fully offline.** Neither export nor restore contacts the network. Both work with
  networking disabled.
- **Export is a pure read.** It never mutates IndexedDB or `localStorage`. Two exports
  taken back-to-back with no user action between them are byte-identical except for
  `exportedAt`.
- **Deterministic filename.** `rutina-backup-YYYY-MM-DD.json`, and never
  `rutina-progreso-*`.
- **Empty state is valid.** Exporting with zero rutinas and zero sessions produces a
  well-formed, restorable file describing an empty install.

---

## Explicitly out of the format

- **Bundled reference data** — `data/equipment.json` and the club directory
  (`data/gyms/`). These ship with the app; they are not user data.
- **Service-worker / Workbox caches.** Rebuildable on next load.
- **Per-club equipment exclusions** — the `clubEquipment` IndexedDB store (set from the
  Catálogo tab's "Equipamiento de tu club" sheet) is **not** currently included. The club
  *selection* (`rutina:club`) is backed up; the per-club tick list is not.

---

## Related

- [Progress export format](export-format.md) — the other, lossy export.
- [`data/schema/backup.schema.json`](../data/schema/backup.schema.json) — the machine-readable envelope schema.
- [Languages](../README.md#languages) — the three-axis model; rutina text inside `data.rutinas[]` is axis-3 user content, copied verbatim, never translated.
