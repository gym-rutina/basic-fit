# Authoring a Rutina with an LLM

This guide turns a training program that lives only in your head (or a coach's notes)
into a `rutina.json` file. Fill in the prompt at the top of this screen, copy it into
**any** LLM chat (ChatGPT, Claude, Gemini, whatever you have on hand), and import what
comes back into the **Rutina** app.

No JSON knowledge required. No account, no API key — this works in a normal browser chat
window.

> **Language.** Field 7 sets the language of the routine text — write it in
> whatever language you want (not limited to English/Spanish/Belarusian; any
> language the LLM can produce). Rutina displays exercise names, day labels,
> technique cues, rules and notes **exactly as the LLM writes them**, in a
> single language, and never translates them, re-labels them, or requires
> them to match the app's own interface language (set separately, under
> **Settings**). Ask the LLM for **one plain string per field** — never a
> multilingual object like `{"en": "Monday", "es": "Lunes"}`.

All reference data lives in the public repository
[github.com/gym-rutina/basic-fit](https://github.com/gym-rutina/basic-fit).
The prompt tells the LLM where to read it — you do **not** need to copy schema or
equipment files yourself.

| Data | URL |
|------|-----|
| Schema (source of truth) | [rutina.schema.json](https://cdn.jsdelivr.net/gh/gym-rutina/basic-fit@main/data/schema/rutina.schema.json) |
| Equipment catalog (optional detail reference) | [equipment.json](https://cdn.jsdelivr.net/gh/gym-rutina/basic-fit@main/data/equipment.json) |
| Reference example | [phase1-monday.json](https://cdn.jsdelivr.net/gh/gym-rutina/basic-fit@main/data/examples/phase1-monday.json) |

> **LLM without web access?** Use the **Download** button in this guide screen to save
> a zip archive of the data files directly to your device — one file, ready to attach to
> the chat, not just an inline browser view. Prefer to fetch them yourself? The table
> above links directly to the raw files in the repository.

## Step 1 — Copy the prompt

Use the **Copy** button above this guide. The prompt starts with **REQUEST** — fill in
every numbered line (plain text, no JSON) before sending.

> **Field 6 — target gym**
> Use the **Club Picker** in the Rutina app — tap the club row on the **Catálogo** tab or
> the club row above the prompt in this guide screen. Once you pick a club, the app fills
> in field 6 (name, city, address) and appends the club-scoped equipment list automatically.
> If your club is not in the directory, type the gym name and address directly into field 6.

| # | Field | Example | Required |
|---|-------|---------|----------|
| 1 | Who is this for / program name | "Elena — Fase 2" | yes |
| 2 | Primary goal this phase | "Hipertrofia, más volumen" | yes |
| 3 | Days per week | 4 | yes |
| 4 | Session length budget | "45-60 min" | yes |
| 5 | Injuries / movements to avoid | "Evitar press militar por hombro derecho" | no — write "none" if none |
| 6 | Target gym | "BasicFit Málaga Alameda — Málaga, Avda. Andalucía" (pre-filled by the Club Picker) | yes |
| 7 | Language for the output text | "Español" | yes |
| 8 | Prior progress export | pasted Markdown from Rutina **Historial → Exportar** | no — omit if starting a first phase |

Putting "output only JSON, nothing else" at both the top (`ROLE`) and the bottom
(`OUTPUT`) is deliberate — it's the single highest-leverage instruction for getting
parseable output from a chat-tuned LLM.

## Step 2 — Import into the Rutina app

1. Copy the LLM's JSON reply (no markdown fences).
2. Open the **Import** screen in the Rutina app and paste it, or upload a `.json` file.
3. Tap **Import**. The app validates against the same schema and equipment catalog.

If validation fails, copy the error list from the app and paste it back into the LLM
chat as your next message. Ask it to fix and re-output the full JSON. Repeat until import
succeeds.

**Optional — validate on your computer:**

```bash
npm run validate-rutina -- path/to/your-rutina.json
```

| Result | Example output | What to do |
|---|---|---|
| Success | `✓ Valid rutina: 4 days, 22 exercises` | Import into the app |
| Schema error | `days[1].label: required` | Paste the whole error block back to the LLM |
| Equipment-id error | `days[2].exercises[0].equipmentId "g3-xx" not found in data/equipment.json` | Same — paste verbatim |

---

## Worked example (one full turn)

**REQUEST filled in (top of the copied prompt):**

```text
1. Who is this for / program name: Elena Rois — Fase 2
2. Primary goal this phase: Hipertrofia, más volumen muscular
3. Days per week: 4
4. Session length budget: 45-60 min
5. Injuries / movements to avoid: ninguna
6. Target gym: BasicFit Málaga Alameda — Málaga, Avda. Andalucía, Centro Comercial Alameda
7. Language for the output text: Español
8. Prior progress export (optional): (ninguna todavía, primera vez usando esto)
```

**LLM reads schema and equipment from URLs in DATA SOURCES, then returns JSON.**

**Import** into the Rutina app, or run `npm run validate-rutina -- data/rutina-nombre-fase2-draft.json`.

---

## Troubleshooting

- **The LLM cannot fetch URLs.** Use the **Download** button in this guide screen to
  save a zip archive of the DATA SOURCES files, then attach it to the chat manually —
  filenames inside match those in the prompt. The raw-URL table above works too, for
  LLMs/browsers that can fetch directly, or you can paste file contents into the chat
  instead.
- **The LLM's chat can't open a `.zip` attachment.** Extract the archive locally, then
  attach or paste the individual files instead — `rutina.schema.json`, `phase1-monday.json`
  (and `equipment.json` if the LLM needs additional muscle-group or video details).
- **The LLM added a friendly intro or wrapped the JSON in a markdown fence.** Re-send
  with: "Output ONLY the JSON object, no markdown fence, no explanation."
- **The reply got cut off mid-JSON (very long programs).** Ask the LLM to "continue
  from where you stopped, still outputting only JSON."
- **Equipment id not found.** The LLM must use only the ids listed in the EQUIPMENT section
  appended to the prompt — not invented ids. Paste the validator error back and ask it to
  re-read the equipment list.
- **Field 6 or the equipment list is missing from the prompt.** You need to pick a club first.
  Open the **Club Picker** on the Catálogo tab or in this guide screen; once a club is
  selected the app fills in field 6 and appends the equipment list automatically.

---

## Using your progress export (field 8)

After running a phase, **Historial → Exportar progreso** in the Rutina app produces a
Markdown text you can paste as-is into field 8. It looks like:

```
Prensa de Pecho (g3-s10)
  · 32kg / difícil
  · 32kg / normal
  · 35kg / fácil

Jalón al Pecho (g3-s30)
  · 45kg / normal
  · 48kg / fácil

Sesiones sin completar:
  · Lunes — 2026-07-01 (abandonada)
```

The LLM reads this as evidence of which weights were manageable, which felt too easy or
too hard, and which sessions were abandoned — and adjusts the next phase accordingly.

**Full format reference:** [`docs/export-format.md`](export-format.md)

---

## Keeping exercises trackable across phases

Progress, prefilled weights, and tutorial links are tracked **per exercise**, not per
machine — two different exercises on the same piece of equipment (a chest press and a
shoulder press on the same multi-station machine, say) are logged, charted, and exported
independently. An exercise is identified by its **name** together with the equipment it
uses, so two things matter when you write the next phase's REQUEST:

- **Reuse the exact name from the previous phase** when this phase repeats an exercise.
  The progress export (field 8) prints each exercise's name exactly as it was logged —
  copy it verbatim rather than rephrasing it ("Prensa de Pecho", not "Press de Pecho" or
  "Chest Press"). A respelled name is treated as a *different* exercise with an empty
  history — you'd lose the weight trend and prefill you built up.
- **`videoQuery` is a search query for *this exercise on this equipment*, not for the
  machine in general.** The app already composes a good query automatically from the
  exercise name and the equipment name — set `videoQuery` only when you want to override
  it (a specific variant, a preferred demo, etc.).

---

## Updating your program

Once a program is loaded, you can replace or remove it from the **Programa** tab:

1. Open the **Programa** tab and scroll to the bottom of the overview.
2. Tap **Reemplazar programa** (Replace program) to go to the import screen and paste a new rutina.json.
3. Or tap **Eliminar programa** (Remove program) to clear the active program and return to first-run state.

Session history is preserved on remove — records are kept but are no longer linked to a program.
