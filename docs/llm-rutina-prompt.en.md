# Authoring a Rutina with an LLM

This guide turns a training program that lives only in your head (or a coach's notes)
into a `rutina.json` file. The app already fills in most of the prompt for you; review
and adjust it at the top of this screen, copy it into **any** LLM chat (ChatGPT, Claude,
Gemini, whatever you have on hand), and import what comes back into the **Rutina** app.

No JSON knowledge required. No account, no API key — this works in a normal browser chat
window.

## What the app fills in for you

The first time you open Rutina, the onboarding assistant asks about your gym, your
program's name/goal, your schedule, and any injuries or movements to avoid — one guided
step per field, each showing what the field is for, how the prompt uses it, and a
concrete example. **Every step is optional**: skip any of them and the prompt leaves that
numbered line blank, ready for you to fill in by hand in the textarea if you change your
mind.

Your answers are saved on this device, with **one single place to edit them later**: the
form on this same guide screen, right above the prompt. There is no separate Settings
entry for this — open it whenever you like, change what you need, and the prompt
recomputes instantly with every edit (any text you typed directly into the textarea is
discarded the moment you touch the form; the note next to the textarea warns you of this).

> **Language.** Field 7 sets the language of the routine text. It's no longer asked as an
> onboarding step: the app fills it in automatically from the active UI language (e.g.
> "English"). Rutina displays exercise names, day labels, technique cues, rules and notes
> **exactly as the LLM writes them**, in a single language, and never translates them,
> re-labels them, or requires them to match the app's own interface language (set
> separately, under **Settings**). If you want output in a language other than the three
> the interface supports (es/en/be), edit field 7 directly in the textarea before
> copying — the LLM can produce any language, not just those three. Ask the LLM for **one
> plain string per field** — never a multilingual object like
> `{"en": "Monday", "es": "Lunes"}`.

The rutina schema and your club's equipment list are **already inlined in the prompt
itself** (the `SCHEMA` and `EQUIPMENT` sections) — nothing to fetch or attach for a first
try. The public repository
[github.com/gym-rutina/basic-fit](https://github.com/gym-rutina/basic-fit) is still the
source of truth for that data; the prompt only falls back to a URL if your chat truncated
the paste (see Troubleshooting below).

> **Prompt got cut off when you pasted it?** Use the **Download** button on this guide
> screen to save `rutina.schema.json` — the full schema, with its descriptions — directly
> to your device, and attach it to the chat manually.

## Step 1 — Review and copy the prompt

Review the form at the top of this screen (name, goal, days per week, session length,
injuries) — the app has already filled it in with what it knows about you. Edit any
field if needed, then use the **Copy** button. The composed prompt's size is shown next
to the button, in case your chat tends to truncate long pastes.

> **Field 6 — target gym**
> Use the **Club Picker** in the Rutina app — tap the club row in the "Your gym"
> onboarding step, on the **Catálogo** tab, or the club row above the prompt in this
> guide screen. Once you pick a club, the app fills in field 6 (name, city, address) and
> appends the club-scoped equipment list automatically. If your club is not in the
> directory, type the gym name and address directly into field 6 in the textarea.

| # | Field | Filled by | Example |
|---|-------|-----------|---------|
| 1 | Who is this for / program name | Onboarding ("Personalize your program" step) · editable on this guide | "Elena — Phase 2 of 3 (volume). 8 months training so far." |
| 2 | Primary goal this phase | Onboarding (same step) · editable on this guide | "I want more muscle in upper body, especially chest and shoulders..." |
| 3 | Days per week | Onboarding ("Your schedule" step) · editable on this guide (1–7 selector) | 4 |
| 4 | Session length budget | Onboarding (same step) · editable on this guide | "45-60 min on weekdays, up to 80 min on Saturdays" |
| 5 | Injuries / movements to avoid | Onboarding ("Before you start" step) · editable on this guide | "Patellar tendinitis in right knee..." — write "none" if none |
| 6 | Target gym | Club Picker (onboarding, Catálogo tab, or this guide) | Chosen club's name, city and address, plus its equipment list |
| 7 | Language for the output text | Active UI language (Settings) — never asked | "English" (autonym of the active language) |
| 8 | Prior progress export | The app's own session history, if you have any logged | Markdown of your sessions, with an "Include my progress" checkbox on by default |

Text fields all have a length cap (fields 1 and 4: 200 characters; field 2: 800; field
5: 500) — over-length text is truncated on save, never rejected while you type.

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

## Worked example (composed prompt)

You don't need to type this by hand — this is what the `REQUEST` block looks like once
you've completed the onboarding assistant (or edited the fields on this guide). The **8
field labels stay in English** across all three guides — that's the prompt's original
wording and it doesn't change with the interface language; only your answers and the
rest of this guide are localized.

```text
### REQUEST

1. Who is this for / program name: Elena — Phase 2 of 3 (volume). 8 months training so far.
2. Primary goal this phase: I want more muscle in upper body, especially chest and shoulders. I love cable machines and Smith press.
3. Days per week: 4
4. Session length budget: 45-60 min on weekdays, up to 80 min on Saturdays
5. Injuries / movements to avoid (write "none"/"ninguna" if none): Patellar tendinitis in right knee (since 2024): no barbell squats or lunges, but leg press with partial range is fine.
6. Target gym (pre-filled by the app's club picker — name, city, address and available equipment ids are listed in the EQUIPMENT section appended below): BasicFit Málaga Alameda, Málaga, Avda. Andalucía s/n (CC Alameda, La Luz)
7. Language for the output text: English
8. Prior progress export (optional — paste Markdown from Rutina app Export, or leave blank): Chest Press (g3-s10)
   · 32kg / hard
   · 32kg / normal
   · 35kg / easy
```

The schema (`SCHEMA`) and your club's equipment list (`EQUIPMENT`) immediately follow
this in the copied prompt — the LLM doesn't need to go fetch anything on its own.

**Import** into the Rutina app, or run `npm run validate-rutina -- data/rutina-nombre-fase2-draft.json`.

---

## Troubleshooting

- **The chat truncated the prompt when you pasted it (long programs or long
  descriptions).** This is the most common failure with a prompt this size. Use the
  **Download** button on this guide screen to save `rutina.schema.json` (the full schema,
  with its descriptions) and attach it to the chat manually, telling the LLM that the
  pasted prompt's `SCHEMA` section got cut off and to use the attached file instead.
- **The LLM added a friendly intro or wrapped the JSON in a markdown fence.** Re-send
  with: "Output ONLY the JSON object, no markdown fence, no explanation."
- **The LLM's reply got cut off mid-JSON (very long programs).** Ask the LLM to "continue
  from where you stopped, still outputting only JSON." This is the opposite problem from
  the one above: here it's the LLM's *reply* that's cut off, not your prompt.
- **Equipment id not found.** The LLM must use only the ids listed in the `EQUIPMENT`
  section appended to the prompt — not invented ids. Paste the validator error back and
  ask it to re-read the equipment list.
- **Field 6 or the equipment list is missing from the prompt.** You need to pick a club
  first. Open the **Club Picker** on the "Your gym" onboarding step, the Catálogo tab, or
  this guide screen; once a club is selected the app fills in field 6 and appends the
  equipment list automatically.

---

## Using your progress export (field 8)

If you already have logged sessions, the guide adds your progress Markdown to field 8
automatically — no copy-paste needed. An **"Include my progress (N sessions)"** checkbox,
on by default, controls whether it's included in this particular copy of the prompt;
uncheck it if you'd rather leave it out. The checkbox resets to checked every time you
open the guide — it's a per-copy choice, not a saved preference.

It looks like:

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
