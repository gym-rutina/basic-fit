# BasicFit Rutina

A multilingual (EN/ES/BE) equipment catalog and training-routine PWA for BasicFit gyms featuring Matrix Aura series strength machines. Includes an offline-capable React PWA for tracking workouts, a static HTML catalog viewer, and an LLM-based routine authoring workflow.

## Overview

27 Matrix equipment items (25 Aura series + Smith Machine + Perfect Squat) across BasicFit locations. Each entry includes multilingual names and instructions (English, Spanish, Belarusian), product images, video links, PDF manuals, and muscle-group targeting.

The **Rutina PWA** (`app/`) lets you import a `rutina.json` training program, log workout sessions with per-exercise weight and difficulty, review history, and export progress — all offline, no backend.

## Quick Start

### Static catalog (no build required)

```bash
npm install
npm run serve
# open http://localhost:3000/equipment-catalog.html
```

### PWA (development)

```bash
npm install
npm run dev
# open http://localhost:5173
```

### PWA (production build)

```bash
npm run build      # outputs to dist/
npm run preview    # serve dist/ at http://localhost:4173
```

## Project Structure

```
basicfit-rutina/
├── app/                            # React + Vite PWA
│   ├── index.html                  # Vite HTML entry
│   ├── public/
│   │   ├── manifest.json           # PWA manifest
│   │   └── icons/                  # PWA icons
│   └── src/
│       ├── main.jsx                # ReactDOM root + SW registration
│       ├── App.jsx                 # HashRouter + route shell
│       ├── components/
│       │   ├── BottomTabBar.jsx    # Persistent bottom navigation (Home/Program/Catalog/History/Progress)
│       │   ├── ProgressCharts.jsx  # Hand-rolled SVG weight/volume/frequency charts
│       │   ├── ConfirmSheet.jsx    # Reusable confirmation sheet
│       │   └── InstallBanner.jsx   # "Add to Home Screen" banner (beforeinstallprompt)
│       ├── hooks/
│       │   └── useInstallPrompt.js # Captures beforeinstallprompt; drives InstallBanner
│       ├── screens/
│       │   ├── ImportScreen.jsx    # Import a rutina.json
│       │   ├── HomeScreen.jsx      # Today's workout summary
│       │   ├── ProgramScreen.jsx   # Full routine view (all days)
│       │   ├── ActiveSessionScreen.jsx  # Live workout logging
│       │   ├── HistoryScreen.jsx   # Past sessions + per-exercise trend
│       │   ├── ProgressScreen.jsx  # Weight/volume/frequency progress charts
│       │   ├── ExportScreen.jsx    # JSON + Markdown export
│       │   └── CatalogScreen.jsx   # Equipment catalog (27 items, EN/ES/BE)
│       ├── lib/
│       │   ├── db.js               # IndexedDB wrapper (idb): activeRutina, sessions, lastWeights
│       │   ├── sessionMachine.js   # Pure session-state reducer
│       │   ├── progress.js         # Session aggregators for Progress charts (no new store)
│       │   ├── exportFormat.js     # sessions[] → { json, markdown }
│       │   ├── today.js            # Heuristic: which day is "today" in the rutina
│       │   ├── validateImport.js   # Browser wrapper around scripts/lib/rutina-validator.js
│       │   ├── difficulty.js       # Difficulty enum (easy/normal/hard) ↔ display labels
│       │   ├── muscleGroups.js     # Muscle group display labels
│       │   ├── relativeTime.js     # Relative time formatting ("hace 2 días")
│       │   └── trends.js           # Per-exercise trend list for History screen
│       └── data/
│           └── equipment.js        # Imports data/equipment.json at build time
├── data/
│   ├── equipment.json              # Complete equipment catalog (27 items)
│   ├── gyms.json                   # BasicFit locations
│   ├── user-weights.json           # Default weights per equipment
│   ├── examples/
│   │   └── phase1-monday.json      # Example rutina.json for first-run import
│   └── schema/
│       ├── equipment.schema.json
│       └── rutina.schema.json      # Schema for training programs
├── design-system/                  # Component library (tokens, primitives, composites)
├── scripts/                        # Node.js build and scraping scripts
│   ├── lib/
│   │   └── rutina-validator.js     # Shared rutina.json validator (isomorphic, used by PWA)
│   ├── build-catalog.js            # Embeds equipment data into equipment-catalog.html
│   ├── build-rutina.js             # Embeds data into legacy rutina_*.html files
│   ├── validate-data.js            # Schema validation for equipment.json
│   └── validate-rutina.js          # CLI validator for rutina.json files
├── tests/
│   └── viewport-check.js           # Puppeteer: no horizontal scroll + tab-bar row-wrap at 280/360/390/412/768px
├── docs/
│   ├── export-format.md            # Export Markdown + JSON format reference (LLM paste contract)
│   ├── llm-rutina-prompt.md            # Redirect — backward compat
│   ├── llm-rutina-prompt-template.txt  # Copy-paste LLM prompt (shared)
│   ├── llm-rutina-prompt.en.md         # English guide
│   ├── llm-rutina-prompt.es.md         # Spanish / Español
│   └── llm-rutina-prompt.be.md         # Belarusian / Беларуская
├── gyms.html                           # Static gym list (id + name + address)
├── equipment-catalog.html          # Static catalog (data embedded, works offline)
├── rutina_*.html                   # Legacy static routine pages
├── vite.config.js                  # Vite + React + vite-plugin-pwa config
└── vitest.config.js                # Vitest config (jsdom, app/src/**/*.test.{js,jsx})
```

## NPM Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server for the PWA (`http://localhost:5173`) |
| `npm run build` | Build PWA for production → `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm test` | Run Vitest test suites (lib modules + component tests) |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:viewport` | Puppeteer viewport regression: 280/360/390/412/768px × routes (requires `npm run preview` running) |
| `npm run validate-data` | Validate `data/equipment.json` against its schema |
| `npm run validate-rutina -- <path>` | Validate a `rutina.json` file against its schema + cross-check `equipmentId` values |
| `npm run serve` | Serve the repo root on port 3000 (for static HTML pages) |
| `npm run build-catalog` | Embed equipment data into `equipment-catalog.html` |
| `npm run build-rutina` | Embed equipment + weights into legacy `rutina_*.html` files |
| `npm run extract-images` | Scrape equipment images from Matrix product pages (Puppeteer) |

## Building the PWA

### Prerequisites

```bash
node --version  # 18+ recommended
npm install
```

### Development

```bash
npm run dev
```

Opens at `http://localhost:5173`. Hot-reload is on. The dev server is configured to allow cross-root imports: `scripts/lib/rutina-validator.js` and `data/equipment.json` are imported directly from outside `app/` — no duplication.

### Production build

```bash
npm run build
```

Output goes to `dist/`. The build:
- Bundles the React app with Vite + Rollup
- Generates a service worker via `vite-plugin-pwa` (Workbox `generateSW`) that precaches the app shell
- Adds a runtime cache rule for equipment images (`images.jhtassets.com`, CacheFirst, 30-day TTL) so previously-viewed equipment stays available offline

```bash
npm run preview          # serve dist/ at http://localhost:4173
npm run test:viewport    # verify no horizontal overflow and tab-bar stays single-row
```

### Running tests

```bash
npm test                 # Vitest suites: sessionMachine, exportFormat, today, db, validateImport, ProgramScreen, ConfirmSheet, useInstallPrompt
npm run validate-data    # data integrity gate (27 equipment items)
```

### Installing the PWA

After `npm run preview` (or deploying `dist/`), open the app in Chrome/Edge on Android or Safari on iOS and use the browser's "Add to Home Screen" / "Install" prompt. The manifest at `app/public/manifest.json` uses a relative `start_url` and `scope` so it works on any static host.

On Chromium-based browsers (Chrome, Edge, Samsung Internet), the app also shows an **InstallBanner** at the top of the screen when the browser fires the `beforeinstallprompt` event. Tap **Instalar** to trigger the native install dialog without needing the browser menu. Tap **Ahora no** to dismiss it for the session; the banner won't reappear once the app is installed.

## Using the PWA

**First launch:** if there's no active rutina yet, a short onboarding carousel introduces what Rutina does and the LLM generate-then-import workflow before handing off to Import. It's skippable from any step, and a small on-demand control keeps it reachable afterward if you want to revisit it. Subsequent opens skip straight past it.

1. **Import a rutina** — paste a `rutina.json` or upload a file. Use `data/examples/phase1-monday.json` to try the flow immediately. Generate your own with the LLM workflow below.
2. **Home** — shows today's day (resolved by matching the day label against the current weekday in Spanish, with a fallback to the first unstarted day). While a session is in progress, Home shows an "EN CURSO" card describing *that* session instead — its own day and `X / Y completados` — with a **Reanudar entrenamiento** button rather than "Empezar entrenamiento"; this holds from the first paint (a skeleton, not a start button, while the check is in flight), so you can't accidentally start a second session on top of one already running. If the check itself fails, Home shows an error with a **Reintentar** button instead of silently offering to start. A purple **"Entrenamiento en curso"** banner — showing the day and progress — sits at the top of every other tab (Programa, Catálogo, Historial, Progreso, Exportar) and jumps back into the session when tapped; it's hidden on Home itself, on the session screen, and during import, and it disappears the moment the session is finished, stopped, or discarded.
3. **Program** — full routine view across all days.
4. **Active session** — tap a day on Home to start. Log weight + difficulty per exercise; the weight field is prefilled with the last weight logged for **that exact exercise**, not for the machine, so two different exercises sharing one piece of equipment (e.g. a chest press and a shoulder press on the same station) keep independent suggested weights and independent history. Right after updating to this version the field starts out empty for every exercise — the caption reads "Sin registros de este ejercicio todavía." — and fills in again the next time you log each one; older sessions aren't backfilled, and that caption is the only explanation you'll see (there's no separate one-time banner). Tapping an exercise's equipment row opens a sheet with a **"Ver técnica de «*exercise name*» en YouTube"** link — the tutorial is scoped to that exercise, not the machine in general, so two exercises sharing one station link to two different searches; the machine's own reference video has moved to the **Catálogo** tab. End the workout one of three ways: **Finalizar sesión** (saved as completed), **Sesión terminada sin completar** (saved as abandoned — still shows up in History as an unfinished session), or **Descartar sin guardar** — a separate, low-emphasis danger action set apart from the other two by hairline dividers, so it can't be mistaken for either save option. Discarding asks "¿Descartar el entrenamiento?", states plainly that nothing will be saved (including any weights already logged) and that it cannot be undone, and only proceeds if you confirm.
5. **History** — past sessions with per-exercise last-3-sessions weight trend. Each card has its own delete (trash) icon; a **Seleccionar** button in the header switches to selection mode, with **Seleccionar todo** to select everything and a **Borrar (n)** bar to delete the checked sessions in one go. Both single and bulk delete ask for confirmation first and cannot be undone. Deleting a session also rolls back any weight prefills it seeded: the next time you log that exercise, the suggested starting weight falls back to your most recent remaining session instead.
6. **Progress** — fifth bottom tab after History: per-exercise weight chart (full history), per-session volume bars (current program's sets×reps × logged weight), and a trailing 12-week training-frequency heatmap — all derived from existing session history (no new store). Volume for older sessions can shift if you later edit the active program's sets/reps.
7. **Export** — download a JSON archive or copy Markdown to clipboard. Optional Web Share on mobile. See [`docs/export-format.md`](docs/export-format.md) for the exact format.
8. **Catalog** — all 27 equipment items with images and instructions (EN/ES/BE).

All data is stored locally in IndexedDB — no account, no server.

## Authoring a Rutina with an LLM

Training programs are authored by pasting a ready-made prompt into any LLM chat — no coding required.

1. Fill in an 8-field checklist (goal, days/week, session length, injuries, gym, output language, etc.)
2. Copy the prompt template, paste your checklist into `REQUEST`, and send to any LLM
3. The prompt points the LLM at public data files in this repo (schema, equipment, gyms, example) — nothing to assemble by hand. If your LLM chat can't fetch URLs (e.g. Perplexity, offline models), the in-app guide also offers a single **Download** button to save a zip archive of the data files and attach it instead.
4. Import the JSON reply into the PWA (or validate locally: `npm run validate-rutina -- path/to/rutina.json`)
5. If validation fails, paste the error text back to the LLM and re-import

When repeating this for a second phase, paste the Markdown from the PWA's **Export** screen as field 8 — the LLM uses it to understand what actually happened (weight progression, difficulty, abandoned sessions). See [`docs/export-format.md`](docs/export-format.md) for the exact format.

Full walkthrough (shown in-app via **Import → guide link**) — pick your language:

| Language | Guide | Prompt template |
|----------|-------|-----------------|
| English | [`docs/llm-rutina-prompt.en.md`](docs/llm-rutina-prompt.en.md) | [`docs/llm-rutina-prompt-template.txt`](docs/llm-rutina-prompt-template.txt) |
| Español | [`docs/llm-rutina-prompt.es.md`](docs/llm-rutina-prompt.es.md) | (same template) |
| Беларуская | [`docs/llm-rutina-prompt.be.md`](docs/llm-rutina-prompt.be.md) | (same template) |

The original [`docs/llm-rutina-prompt.md`](docs/llm-rutina-prompt.md) redirects to the English guide.

## Data Format

### Equipment entry (abbreviated)

```json
{
  "id": "g3-s10",
  "modelCode": "G3-S10",
  "series": "Aura",
  "category": "chest",
  "muscleGroup": {
    "primary": ["pectoralis-major"],
    "secondary": ["triceps", "anterior-deltoid"]
  },
  "names": { "en": "Chest Press", "es": "Prensa de Pecho", "be": "Жым ад грудзей" },
  "images": [{ "url": "https://images.jhtassets.com/...", "isMain": true }],
  "instructions": {
    "en": "<ol><li>Step 1</li></ol>",
    "es": "<ol><li>Paso 1</li></ol>",
    "be": "<ol><li>Крок 1</li></ol>"
  },
  "gyms": [1, 2, 3, 4, 5, 6, 7]
}
```

### Rutina entry (abbreviated)

```json
{
  "meta": { "name": "Phase 1", "language": "es", "goal": "strength" },
  "days": [
    {
      "label": "Lunes",
      "exercises": [
        { "equipmentId": "g3-s10", "sets": 3, "reps": "10", "restSeconds": 60 }
      ]
    }
  ]
}
```

Full schemas: `data/schema/equipment.schema.json` and `data/schema/rutina.schema.json`.

## Equipment Catalog

### Chest (3)
G3-S10 Chest Press · G3-S12 Pectoral Fly · G3-S13 Converging Chest Press

### Shoulders (4)
G3-S20 Shoulder Press · G3-S21 Lateral Raise · G3-S22 Rear Delt Fly · G3-S23 Converging Shoulder Press

### Back (4)
G3-S30 Lat Pulldown · G3-S31 Seated Row · G3-S33 Diverging Lat Pulldown · G3-S34 Diverging Seated Row

### Arms (3)
G3-S40 Arm Curl · G3-S42 Triceps Press · G3-S45 Tricep Extension

### Core (5)
G3-S50 Abdominal · G3-S51 Abdominal Crunch · G3-S52 Back Extension · G3-S55 Rotary Torso · G3-S60 Dip/Chin Assist

### Legs (8)
G3-S70 Leg Press · G3-S71 Leg Extension · G3-S72 Seated Leg Curl · G3-S73 Prone Leg Curl · G3-S74 Hip Adductor · G3-S75 Hip Abductor · Smith Machine (G1-FW161) · Perfect Squat (VY-400)

## Gym Locations

BasicFit locations:

1. Armengual de la Mota — Calle Armengual de la Mota 26, 29007 (Centro)
2. Héroe de Sostoa — Calle Héroe de Sostoa 51
3. Alameda — CC Alameda, Avda. Andalucía s/n (La Luz)
4. Félix García Palacios — Calle Félix García Palacios 1
5. Teatinos — Bulevar Louis Pasteur 20
6. El Palo — Calle Olmos 43
7. Rincón de la Victoria (nearby; address to be confirmed)

## Contributing

To add or update equipment:

1. Edit `data/equipment.json`
2. Follow the existing structure (EN/ES/BE content required)
3. Run `npm run validate-data` — must pass
4. Run `npm run build-catalog` to update the static HTML catalog

## License

For personal use. Equipment specifications and names are based on publicly available Matrix Fitness documentation.

## Resources

- [Matrix Fitness](https://www.matrixfitness.com/)
- [BasicFit](https://www.basic-fit.com/en-es/gyms)
- [Matrix Manuals](https://jhtsupport.com/eng/matrix/manuals/)
