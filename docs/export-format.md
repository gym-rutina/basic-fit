# Export Format Reference

This document specifies the exact format of the two artifacts the PWA generates on the
**Export** screen. Both are derived from the same underlying session history stored in
IndexedDB. The Markdown format is the primary one — it is designed to be pasted directly
into an LLM chat as context for generating the next training phase.

Both artifacts group logged sets by **exercise**, not by machine — see
[Exercise key](#exercise-key) below. Two different exercises performed on the same piece
of equipment (a chest press and a shoulder press on the same multi-station machine, say)
produce two independent blocks / JSON entries.

**Source:** `app/src/lib/exportFormat.js` (`buildExportPayload`),
`app/src/lib/exerciseKey.js` (`exerciseKey`, `slugifyExerciseName`).

---

## Exercise key

Every logged exercise is identified by a **derived key**, computed at read time from the
session record — it is never stored as its own field:

```js
exerciseKey = `${equipmentId ?? ''}::${slugifyExerciseName(name)}`
```

- **Machine exercise:** `<equipmentId>::<slug-of-name>` — e.g. `g3-s10::prensa-de-pecho`.
- **Bodyweight exercise** (no `equipmentId`): `::<slug-of-name>` — e.g. `::plancha`.
- If the name slugs to `''` but `equipmentId` is present, the key falls back to the bare
  `equipmentId`.
- If both `equipmentId` and the slugged name are empty, the key is `null` — the exercise
  is **not trackable** and contributes nothing to either export artifact (the same
  treatment as an abandoned exercise).

`slugifyExerciseName` lowercases the name, strips accents, and collapses anything that
isn't a letter or digit into a single `-`. `"Prensa de Pecho"` and `"prensa   DE pecho"`
both slug to `prensa-de-pecho` and therefore share one history — including across
different imported programs/phases (a repeated exercise in Fase 1 and Fase 2 is one
continuous series, not two).

The same rule applies to a name written in a non-Latin script (Cyrillic, Greek, CJK,
Arabic, Hebrew…), matching Unicode letters instead of `a-z` — so, for example, two
differently-spelled Belarusian exercise names on the same machine produce two distinct,
non-empty keys, the same way two differently-spelled Spanish or English names would.
This is exercise-key data — axis-3 **user content** in the
[three-axis language model](../README.md#languages) — and is unaffected by which UI
language is active.

Because the key is derived from the exercise's **name**, keep the spelling identical
across phases when it's the same exercise — a respelled name (`"Press de Pecho"` instead
of `"Prensa de Pecho"`) is a *different* key with its own empty history. See the
name-stability guidance in the [LLM authoring guide](llm-rutina-prompt.en.md).

---

## Markdown export (LLM paste format)

### Purpose

Copy this text and paste it into an LLM chat as field 8 of the
[rutina authoring prompt](llm-rutina-prompt.en.md) ("Prior progress export"). The LLM
uses it to understand how each exercise actually went — which weights were manageable,
which felt too easy or too hard — and to adjust the next phase accordingly.

### How to get it

1. Open the **History** tab in the PWA.
2. Tap **Exportar progreso**.
3. Select a date range (default: all sessions).
4. Tap **Copiar al portapapeles** (or **Compartir** on mobile).

On Android Chrome/Edge you can also tap **⬇ Descargar .json** to download both formats
together in one file.

### Format

```
<Exercise name (equipmentId)>
  · <weightUsed>kg / <difficulty>
  · <weightUsed>kg / <difficulty>
  ...

<Exercise name (equipmentId)>
  · <weightUsed>kg / <difficulty>
  ...

<Exercise name>
  · <weightUsed>kg / <difficulty>
  ...

Sesiones sin completar:
  · <dayLabel> — <YYYY-MM-DD> (abandonada)
```

**Rules:**
- One block per **exercise** (equipment + name pair) that was logged at least once — a
  single `equipmentId` may now head **several** blocks, one per exercise performed on
  that piece of equipment.
- Entries within a block are in chronological order (oldest → newest), one line each.
- **Blocks themselves are ordered alphabetically by exercise name**, locale-aware
  (`localeCompare` under the active UI language) — not by when the exercise was first
  logged. Two exports of the same session history are therefore byte-identical
  regardless of the order sessions happened to be logged in. (The JSON export's key
  order is different and unaffected by this — see [JSON export](#json-export) below.)
- The `(equipmentId)` parenthetical is **omitted** for a bodyweight exercise (no
  `equipmentId`) — the header is just the exercise name, e.g. `Plancha`.
- Exercises from abandoned sessions are **excluded** from the per-exercise blocks
  (they were never completed, so no weight/difficulty was recorded). Abandoned sessions
  are called out in a trailing, **localized** heading instead (`Sesiones sin
  completar:` / `Unfinished sessions:` / `Незавершаныя сесіі:`), each line marked with a
  localized `(abandonada)` / `(abandoned)` / `(пакінута)`.
- Exercises whose [exercise key](#exercise-key) is `null` (no `equipmentId` and an
  unslugifiable name) are excluded — there is nothing stable to group them under.
- If there are no logged sessions, the output is a single **localized** line:
  `Sin sesiones registradas todavía.` / `No sessions recorded yet.` /
  `Пакуль няма запісаных сесій.`

Difficulty is printed as a **localized, lowercased word** — `fácil`/`normal`/`difícil`,
`easy`/`just right`/`hard`, or `лёгка`/`у самы раз`/`цяжка` — following whatever UI
language was active when you tapped **Exportar progreso**. This is display chrome and
is distinct from the JSON export's frozen `easy`/`normal`/`hard` tokens below. Every
heading, label and the difficulty word above is chrome; exercise names, day labels,
weights and dates are user content and are copied verbatim regardless of UI language —
see [Languages](../README.md#languages) in the main README.

### Worked example

> Shown here as it renders with the Spanish UI chrome (`Sesiones sin completar:`,
> `abandonada`, and the `fácil`/`normal`/`difícil` difficulty words) — the default,
> since the exercises below are themselves authored in Spanish. Exporting the same
> history under the English or Belarusian UI changes only those chrome strings; the
> exercise names, weights and dates render identically either way.

Given three sessions:
- 2026-07-01 — Lunes (abandoned, nothing logged)
- 2026-07-06 — Lunes (completed): Prensa de Pecho 32 kg / hard **and** Press de Hombro
  18 kg / normal — both on machine `g3-s10` — plus Jalón al Pecho 45 kg / normal
  (`g3-s30`) and Plancha 0 kg / normal (bodyweight, no `equipmentId`)
- 2026-07-08 — Lunes (completed): Prensa de Pecho 32 kg / normal, Jalón al Pecho 48 kg / fácil

The Markdown export is:

```
Jalón al Pecho (g3-s30)
  · 45kg / normal
  · 48kg / fácil

Plancha
  · 0kg / normal

Prensa de Pecho (g3-s10)
  · 32kg / difícil
  · 32kg / normal

Press de Hombro (g3-s10)
  · 18kg / normal

Sesiones sin completar:
  · Lunes — 2026-07-01 (abandonada)
```

Note that `g3-s10` heads **two** blocks — Prensa de Pecho and Press de Hombro are tracked
independently even though they share a machine — that Plancha's header has no
parenthetical because it has no `equipmentId` — and that the blocks are alphabetical
(Jalón, Plancha, Prensa, Press), not in the order the exercises were first logged
(which was Prensa/Press, then Jalón, then Plancha across the three sessions above).

---

## JSON export

### Purpose

A complete, machine-readable archive of every logged exercise, keyed by
[exercise key](#exercise-key) rather than by machine. Nothing in the PWA re-imports
this file — the Import screen only accepts `rutina.json` training programs — so treat
it as a backup or a cross-reference against the Markdown text, not a round-trip format.

### Format

```json
{
  "exercises": {
    "<exerciseKey>": [
      {
        "date": "YYYY-MM-DD",
        "weightUsed": <number>,
        "difficulty": "easy" | "normal" | "hard"
      }
    ]
  },
  "exerciseNames": {
    "<exerciseKey>": "<exercise name as logged>"
  }
}
```

**Rules:**
- `json.exercises` is keyed by [exercise key](#exercise-key), not by `equipmentId`
  alone — a bodyweight exercise's key looks like `::plancha`, and one `equipmentId` may
  own several keys (one per exercise performed on it).
- `exerciseNames` is a sibling map from the same exercise key to the exercise's display
  name, so the file stays self-describing even though the keys themselves are opaque
  `equipmentId::slug` strings.
- `difficulty` uses the internal tokens (`easy` / `normal` / `hard`), not the
  display labels used in the Markdown (`fácil` / `normal` / `difícil`).
- Entries per exercise key are in chronological order, oldest first.
- Only completed exercises are included (same rule as Markdown: abandoned/unlogged
  exercises contribute nothing to the per-exercise arrays). Exercises whose exercise key
  is `null` are excluded the same way.
- Date is derived from `completedAt` (the timestamp the user tapped "Marcar completado"),
  truncated to `YYYY-MM-DD` in UTC.
- There is no top-level session or date-range envelope — the file is a flat per-exercise
  log. If you exported with a date range filter, entries outside that range are simply
  absent (the filter is applied before serialisation, not recorded in the file).

### Worked example (same three sessions as above)

```json
{
  "exercises": {
    "g3-s10::prensa-de-pecho": [
      { "date": "2026-07-06", "weightUsed": 32, "difficulty": "hard" },
      { "date": "2026-07-08", "weightUsed": 32, "difficulty": "normal" }
    ],
    "g3-s10::press-de-hombro": [
      { "date": "2026-07-06", "weightUsed": 18, "difficulty": "normal" }
    ],
    "g3-s30::jalon-al-pecho": [
      { "date": "2026-07-06", "weightUsed": 45, "difficulty": "normal" },
      { "date": "2026-07-08", "weightUsed": 48, "difficulty": "easy" }
    ],
    "::plancha": [
      { "date": "2026-07-06", "weightUsed": 0, "difficulty": "normal" }
    ]
  },
  "exerciseNames": {
    "g3-s10::prensa-de-pecho": "Prensa de Pecho",
    "g3-s10::press-de-hombro": "Press de Hombro",
    "g3-s30::jalon-al-pecho": "Jalón al Pecho",
    "::plancha": "Plancha"
  }
}
```

Note: `g3-s10` now owns two independent entries instead of the second exercise
overwriting the first, and `exerciseNames` lets a reader (or an LLM) map each opaque key
back to a display name without cross-referencing the Markdown. The 2026-07-01 abandoned
session still contributes no entries to any exercise key.

---

## Cross-device workflow

The PWA stores everything locally (IndexedDB, no cloud). To close the loop — log
workouts on your phone, then generate the next phase from a laptop — the intended flow is:

```
Phone                               Laptop / any device
─────                               ──────────────────
History → Exportar progreso
  ↓
Copiar al portapapeles
  ↓
Share to yourself (notes, chat,
  clipboard sync, screenshot,
  whatever you use) ──────────────▶ Paste into LLM chat (field 8)
                                      ↓
                                    LLM generates next phase rutina.json
                                      ↓
                                    npm run validate-rutina -- <path>
                                      ↓
                                    Import into PWA on phone
```

The Web Share button (↗ Compartir) uses the OS share sheet on Android — you can share
the Markdown text directly to WhatsApp, Notes, Telegram, email, or any installed app
without copying and pasting manually.
