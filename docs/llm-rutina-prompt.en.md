# Create your routine with an AI chat

Turn a training program that only lives in your head (or in a coach's notes) into a
routine the app can import. Rutina writes the prompt for you, you paste it into **any** AI
chat (ChatGPT, Claude, Gemini, whatever you have), and you bring the reply back. No
JSON knowledge, no account, no API key — a normal browser chat is enough.

## The flow

1. **Start.** On the import screen, tap **Prepare prompt**.
2. **Answer a few questions (step 1 of 2).** Choose your club, then fill in your primary
   goal, days per week, session length and any injuries or movements to avoid. The
   program name is under **More options**. Everything is optional. Your answers are saved
   on this device, so next time you see them under **Review your answers**. Tap **Next**.
3. **Copy the prompt (step 2 of 2).** Tap **Copy prompt**, paste it into your AI chat and
   send it.
4. **Copy the reply.** When the AI answers, copy the complete JSON block it returns.
5. **Import it.** Back in the app, tap **I have the JSON →**, paste the reply (or tap
   **Choose .json file**), then tap **Import**. If you already have a program, the app
   then asks whether to **Activate now** or **Save without activating**.

**Import shows errors?** Tap **Copy errors**, paste them into the same chat and ask the
AI to fix them and send the complete JSON again. Repeat until the import succeeds.

## Get a better result

- **Choose your club.** The prompt then lists only the machines your club has, so the AI
  builds a routine you can actually do. Without your club it can't know which machines
  you have.
- **Your club lacks a machine?** Mark it absent and the prompt shrinks to match. On the
  **Catalog** tab, tap the chip under its card (**In my club** ↔ **Not in my club**), or
  go to **Settings → My club → Club equipment**. Both edit the same list. With **Only my
  club** on, an excluded card disappears from the catalog; turn it off to see the card
  again.
- **Language.** The prompt asks for the routine in the app's current language. Want
  another one? Just tell the AI in the chat, for example "answer in Portuguese". Ask for
  one language only, not translations side by side.
- **Previous sessions.** Once you've logged sessions, step 2 shows **Include my previous
  sessions**, on by default. The AI reads which weights were manageable and adjusts the
  next phase. Untick it to leave them out; the choice applies to this copy only.
- **Several phases.** Ask the AI for a **multi-phase plan** and import each phase
  separately. They sit side by side in **My routines**, ready to activate in order.
- **Same exercise, same name.** Progress and weights follow each exercise (its name
  together with its equipment). Ask the AI to reuse the exact names from the previous
  phase: a respelled name counts as a new exercise with an empty history.

## Equipment the catalog doesn't have

If your club has a machine that isn't in the catalog, or the AI swaps a machine your club
lacks for another one, it may record that in the routine. You never write any of it. A
machine added this way belongs to that routine only and is tracked like any catalog item;
swaps are kept with the routine but not shown on screen.

## Troubleshooting

- **The chat cut off your prompt when you pasted it.** The most common problem with a
  long prompt. At the bottom of this guide, tap **Download** to save the full schema, then
  attach that file to the chat and tell the AI the pasted prompt was cut off and it should
  use the attached file.
- **The AI added an intro, or wrapped the JSON in a code block.** Reply: "Send only the
  JSON, no code block, no explanation."
- **The reply stops in the middle of the JSON (very long programs).** Ask the AI to
  "continue from where you stopped, still sending only JSON". If the import still fails,
  ask it to resend the complete JSON in one message.
- **An error says a piece of equipment wasn't found.** The AI must use only the machines
  listed in the prompt. Tap **Copy errors**, paste them into the chat and ask it to re-read
  the equipment list and correct the routine.

## Managing your routines

Open the **Program** tab, then **My routines**:

1. Tap **Import routine** to add a new one. Importing never overwrites what you already
   have.
2. Tap **Activate** on an entry to make it your current program.
3. Tap the trash icon on an entry and confirm (**Remove**) to delete only that one.

Removing a routine never touches your history: past sessions stay in **History**, still
linked to their program. Logged weights carry across programs too.
