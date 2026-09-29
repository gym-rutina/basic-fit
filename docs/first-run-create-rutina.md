# Create your first rutina

A new install has an empty library, so the app opens on **Crea tu rutina** (`#/import`). Three ways in:

| Path | Use it when | Where it goes |
|------|-------------|---------------|
| **Preparar prompt** (recommended) | You have no `rutina.json` yet | Prompt wizard, then your AI assistant, then paste the JSON back |
| **Ya tengo un rutina.json** | You already have a valid file or JSON text | Straight to the JSON screen |
| **Restaurar copia…** | You have a backup file from another device | Restore sheet (see [Backup Format Reference](backup-format.md)) |

The fork appears **only while your library is empty**. Once you have at least one rutina, Import opens straight on the JSON screen, and the wizard stays reachable from it via **Preparar prompt**.

## Guided path: prompt, AI, JSON (~3 min)

You use your own AI assistant (ChatGPT, Claude, Gemini, ...). No JSON knowledge needed.

### Step 1 of 2 — Tu objetivo

Everything is optional; skipping a field just leaves it out of the prompt.

- **Goal** (free text), **days per week** (1-7), **session length**, **injuries or movements to avoid**.
- **Program name** sits under **Más opciones**.
- If you already answered these during onboarding, the screen opens as **Revisa tus respuestas**, pre-filled. Change what you like.

Press **Siguiente**. **Atrás** returns without losing what you typed.

### Step 2 of 2 — Copia tu prompt

1. Check the club row (`Club · N máquinas`). The prompt lists your club's machines so the AI only uses what you have. **Cambiar** / **Elige tu club** opens the club picker; without a club the AI cannot know your equipment (a warning says so).
2. Optionally tick **Incluir mis sesiones anteriores** (shown when you have history) so the AI can progress from what you actually lifted.
3. Read the preview (**Ver completo** / **Ver menos**), then press **Copiar prompt**. If the browser blocks clipboard access, long-press the text and copy it manually.
4. Follow the three instructions on screen:
   1. Paste it into your AI assistant.
   2. Copy the **entire** JSON block it returns.
   3. Come back and paste it.
5. **Ya tengo el JSON →** continues to the JSON screen. **Guía completa** opens the full in-app guide (troubleshooting, schema download, language versions).

## JSON screen

- Paste into the text area or **Elegir archivo .json**.
- **Cargar ejemplo** fills in a sample rutina so you can try the flow.
- The JSON is validated as you go. A valid rutina shows **Rutina validada**; on first run it saves and activates. With rutinas already in the library you choose **Activar ahora** or **Guardar sin activar**.

### When validation fails: Copiar errores

Errors are listed with a count (`N errores de validación`). Press **Copiar errores**, paste them back into the same AI chat, ask for a corrected JSON, and import again. Repeat until it validates.

## Restore from a backup

Choose **Restaurar copia…** on the fork, pick your `rutina-backup-YYYY-MM-DD.json`, and confirm. Restore replaces local data; on an empty install nothing is lost.

## Notes

- The prompt text itself is unchanged; see [`llm-rutina-prompt.en.md`](llm-rutina-prompt.en.md) for the field-by-field guide.
- The club and equipment exclusions are the same ones you manage in **Settings → Mi club** (and toggle per item from the Catálogo tab's cards).
