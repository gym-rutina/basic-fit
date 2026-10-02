# BasicFit Rutina

A six-language (EN/ES/BE/FR/NL/DE) equipment catalog and training-routine PWA for BasicFit gyms, covering Matrix Aura series strength machines plus ZIVA free weights and accessories. Includes an offline-capable React PWA for tracking workouts and an LLM-based routine authoring workflow.

## Overview

48 equipment items (29 machines, 14 free weights, 5 accessories — spanning the Matrix Aura line plus ZIVA free weights and accessories) across BasicFit locations. Each entry includes multilingual names and instructions (English, Spanish, Belarusian, French, Dutch, German), product images, video links, PDF manuals, and muscle-group targeting.

A bundled club directory covers 1,727 BasicFit locations across 6 countries (Netherlands, Belgium, France, Luxembourg, Spain, Germany). The PWA's **Club Picker** lets you search it by country → city → club and remembers your choice (you manage it in **Settings → Mi club**); the Catálogo tab uses it to offer a "just my club's equipment" filter. See "Selecting your club" below.

The **Rutina PWA** (`app/`) lets you build a library of imported `rutina.json` training programs — several kept side by side, exactly one active at a time, switchable without losing session history or your logged weights — log workout sessions with per-exercise weight and difficulty, review history across all of them, export progress, and back up / restore everything the app knows. All offline, no backend.

## Quick Start

The repo's former standalone static HTML viewers (the old equipment-catalog page, the gym list, and the legacy routine pages) are retired — everything they showed lives in the PWA. `data/equipment.json` still gets a maintenance pass via `npm run normalize-equipment` (see NPM Scripts below); it just no longer generates a static page.

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
│       │   ├── ClubAccessSection.jsx  # Settings "Acceso al club" section (save/open a Basic-Fit invite link)
│       │   ├── MiClubSection.jsx  # Settings "Mi club" section (club name + address, change club, equipment-list entry with count hint)
│       │   ├── ClubMembershipChip.jsx  # Catalog per-card "En mi club" / "Fuera de mi club" toggle (presentational; the screen owns the one write path)
│       │   ├── BackupSection.jsx  # Settings "Copia de seguridad" section (download a full backup, opens RestoreSheet)
│       │   ├── RestoreSheet.jsx   # Pick file → parse+validate → count-bearing confirm → atomic restore
│       │   ├── LibraryScreen.jsx  # /library — "Mis rutinas": activate/delete imported rutinas (exactly one active)
│       │   └── InstallBanner.jsx   # "Add to Home Screen" banner (beforeinstallprompt)
│       ├── hooks/
│       │   └── useInstallPrompt.js # Captures beforeinstallprompt; drives InstallBanner
│       ├── screens/
│       │   ├── ImportScreen.jsx    # Import a rutina.json; empty state also offers "Restaurar copia…" (RestoreSheet)
│       │   ├── HomeScreen.jsx      # Next-workout proposal + day picker + recent sessions + club access button
│       │   ├── ProgramScreen.jsx   # Full routine view (all days)
│       │   ├── ActiveSessionScreen.jsx  # Live workout logging
│       │   ├── HistoryScreen.jsx   # Past sessions + per-exercise trend
│       │   ├── ProgressScreen.jsx  # Weight/volume/frequency progress charts
│       │   ├── ExportScreen.jsx    # JSON + Markdown export
│       │   ├── CatalogScreen.jsx   # Equipment catalog (48 items, EN/ES/BE/FR/NL/DE) + "Solo mi club" filter + per-card club chip
│       │   └── SettingsScreen.jsx  # Settings screen (UI language switcher, backup/restore, club access link, my club + club equipment)
│       ├── lib/
│       │   ├── db.js               # IndexedDB wrapper (idb): rutinas library + activeRutina pointer, sessions, lastWeights, clubEquipment; readAllForBackup + atomic restoreFromBackup
│       │   ├── sessionMachine.js   # Pure session-state reducer
│       │   ├── progress.js         # Session aggregators for Progress charts (no new store)
│       │   ├── exportFormat.js     # sessions[] → { json, markdown }
│       │   ├── nextDay.js          # Which day is proposed next (rotation from the active rutina's last completed session)
│       │   ├── validateImport.js   # Browser wrapper around scripts/lib/rutina-validator.js
│       │   ├── difficulty.js       # Difficulty enum (easy/normal/hard) ↔ display labels
│       │   ├── muscleGroups.js     # Muscle group display labels
│       │   ├── relativeTime.js     # Relative time formatting ("hace 2 días")
│       │   ├── trends.js           # Per-exercise trend list for History screen
│       │   ├── inviteUrl.js        # Invite-link validator (trim → URL ctor → https-only allowlist)
│       │   ├── inviteStorage.js    # Invite-URL persistence ('rutina:clubInviteUrl'; degrade-don't-throw)
│       │   ├── libraryNoticeStorage.js  # One-shot "Mis rutinas" migration-notice flag ('rutina:libraryNoticeSeen')
│       │   ├── backupFormat.js     # buildBackup/parseBackup/reconcileLastWeights — the backup envelope, pure + isomorphic
│       │   ├── settingsRegistry.js # The 6-key localStorage allowlist backed up/restored (readAllSettings/writeAllSettings)
│       │   └── appVersion.js       # package.json `version`, stamped into the backup envelope's `appVersion` field
│       └── data/
│           └── equipment.js        # Imports data/equipment.json at build time
├── data/
│   ├── equipment.json              # Complete equipment catalog (48 items: 29 machine / 14 free-weight / 5 accessory)
│   ├── gyms.json                   # Legacy 7 hand-entered Malaga gyms (still the app's only club source pre-Build B)
│   ├── gyms/                       # Scraped multi-country club directory (1,727 clubs, 6 countries) — see below
│   │   ├── index.json              #   per-country totals + per-city club counts
│   │   └── <CC>.json               #   one file per country (NL/BE/FR/LU/ES/DE)
│   ├── user-weights.json           # Default weights per equipment
│   ├── examples/
│   │   └── phase1-monday.json      # Example rutina.json for first-run import (incl. a gear + a bodyweight exercise)
│   └── schema/
│       ├── equipment.schema.json
│       ├── rutina.schema.json      # Schema for training programs
│       └── backup.schema.json      # Full-data backup envelope schema (draft-07, additionalProperties: true)
├── design-system/                  # Component library (tokens, primitives, composites)
├── scripts/                        # Node.js build and scraping scripts
│   ├── lib/
│   │   ├── rutina-validator.js     # Shared rutina.json validator (isomorphic, used by PWA)
│   │   └── gym-scrape-core.js      # Pure scraper core (parsing/pagination/city grouping) — no fs/path/process, unit-tested with no network
│   ├── scrape-gyms.js              # I/O shell for the club directory scrape — network + writes data/gyms/ (see below)
│   ├── normalize-equipment.js      # Fixup pass over data/equipment.json — writes only when content actually changes
│   ├── validate-data.js            # Schema + directory validation for equipment.json and data/gyms/
│   └── validate-rutina.js          # CLI validator for rutina.json files
├── tests/
│   └── viewport-check.js           # Puppeteer: no horizontal scroll + tab-bar row-wrap at 280/360/390/412/768px
├── docs/
│   ├── export-format.md            # Export Markdown + JSON format reference (LLM paste contract)
│   ├── backup-format.md            # Full-data backup envelope reference (distinct from the export above)
│   ├── llm-rutina-prompt-template.txt  # Copy-paste LLM prompt (shared)
│   ├── llm-rutina-prompt.en.md         # English guide
│   ├── llm-rutina-prompt.es.md         # Spanish / Español
│   └── llm-rutina-prompt.be.md         # Belarusian / Беларуская
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
| `npm run validate-data` | Validate `data/equipment.json` (and `data/gyms/`, when present) against their required shape |
| `npm run validate-rutina -- <path>` | Validate a `rutina.json` file against its schema + cross-check `equipmentId`/`extraEquipment` values |
| `npm run serve` | Serve the repo root on port 3000 |
| `npm run normalize-equipment` | Fixup pass over `data/equipment.json` (resolves video-search placeholders, rewrites dead JHT manual URLs). Writes the file **only when something actually changed** — safe to run repeatedly, and a no-op run prints a message instead of rewriting the file. |
| `npm run scrape-gyms` | Scrapes the BasicFit club directory (6 countries) from `basic-fit.com`'s internal storefront endpoints and writes `data/gyms/index.json` + one file per country. Network-only — nothing in the test suite runs it. Already run once in this repo (`data/gyms/` holds real data, 1,727 clubs); re-run it any time to refresh (see "Data maintenance scripts" below). |
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
npm test                 # Vitest suites: sessionMachine, exportFormat, nextDay, db, rutinaLibrary, validateImport, ProgramScreen, LibraryScreen, ConfirmSheet, useInstallPrompt, inviteUrl, inviteStorage, ClubAccessSection, backupFormat, settingsRegistry, db.backup, BackupSection, RestoreSheet, ExportScreen.regression, scraper/normalize/validator scripts
npm run validate-data    # data integrity gate (48 equipment items; also validates data/gyms/ when present)
```

### Installing the PWA

After `npm run preview` (or deploying `dist/`), open the app in Chrome/Edge on Android or Safari on iOS and use the browser's "Add to Home Screen" / "Install" prompt. The manifest at `app/public/manifest.json` uses a relative `start_url` and `scope` so it works on any static host.

On Chromium-based browsers (Chrome, Edge, Samsung Internet), the app also shows an **InstallBanner** at the top of the screen when the browser fires the `beforeinstallprompt` event. Tap **Instalar** to trigger the native install dialog without needing the browser menu. Tap **Ahora no** to dismiss it for the session; the banner won't reappear once the app is installed.

## Data maintenance scripts

Two Node scripts keep `data/` current. Both replace the old `scripts/build-catalog.js` (deleted, along with `equipment-catalog.html` and the `build-catalog` npm script — it used to do double duty as an equipment-data fixup pass *and* a static-page generator; those are now two independent things).

### Equipment fixups — `scripts/normalize-equipment.js`

```bash
npm run normalize-equipment
```

Runs two idempotent fixups over `data/equipment.json`:

- resolves `SEARCH_REQUIRED` video-URL placeholders into a YouTube search link (built from the quoted term in the video's `note`, or the equipment's own name as a fallback)
- rewrites dead per-product JHT manual URLs to the manuals list page + a `searchTerm`

It **writes the file only when the normalized content actually differs** from what's on disk — a clean run prints `normalize-equipment: no changes` and leaves the file (including `metadata.lastUpdated`) untouched, rather than re-stamping today's date on every run. Safe to run repeatedly, including in CI.

### Gym directory — `scripts/scrape-gyms.js`

```bash
npm run scrape-gyms
```

Scrapes BasicFit's storefront (`basic-fit.com`'s internal `Store-FinderMap`/`Store-FinderMore` endpoints, not a public API) for every club across 6 countries — Netherlands, Belgium, France, Luxembourg, Spain, Germany — and writes:

- `data/gyms/index.json` — per-country totals and per-city club counts
- `data/gyms/<CC>.json` (one per country) — `{ id, name, city, address, legacyId? }` per club. `cityKey`, `coordinates`, `hours`, and `url` are deliberately never stored (`hours`/`url` alone are ~59% of the raw payload; `cityKey` and `coordinates` had no downstream reader).

**`data/gyms/` is populated with real data** — 1,727 clubs total: NL 255, BE 243, FR 911, LU 10, ES 246, DE 62. The PWA's Club Picker (see "Selecting your club" below) reads this directory directly; it is a bundled build-time module, not a runtime fetch. There is no scheduled job re-running the scrape yet (that's a separate, not-yet-built piece) — re-run `npm run scrape-gyms` by hand whenever the directory needs a refresh. The legacy 7-gym `data/gyms.json` file still exists alongside it as a historical record of the original hand-entered clubs; neither the PWA nor any script reads it any more.

The script is split across two files on purpose, and that boundary matters for anyone touching it:

- **`scripts/lib/gym-scrape-core.js`** — pure logic only (HTML/GeoJSON parsing, pagination, city-name grouping, sorting, the legacy-GUID table). No `fs`, `path`, `process`, or `axios` imports — this is what lets it be unit-tested against a committed fixture with zero network access. This is the same isomorphic-module rule `scripts/lib/rutina-validator.js` already follows; keep it that way if you extend either file.
- **`scripts/scrape-gyms.js`** — the thin I/O shell: HTTP requests (axios), a custom `User-Agent`, a 400 ms politeness delay between requests, and the actual file writes. All of the "what does upstream actually say" logic goes in `scripts/lib/gym-scrape-core.js`, not here.

Two safety behaviors worth knowing before running it:

1. **Pagination never stops early.** BasicFit's `Store-FinderMore` endpoint returns HTTP 200 even on an incomplete page (`isComplete: false`) — a naive loop that stops at the first short-looking page silently ships a fraction of a country's clubs with no error. `paginate()` in `gym-scrape-core.js` only returns once the upstream response says `isComplete: true`; every other exit throws.
2. **A big club-count drop refuses to write.** If a country's scraped club count falls by more than 20% versus what's already on disk, the script throws instead of overwriting `data/gyms/` — that's treated as upstream breakage, not real churn, and existing data is left exactly as it was.

**Legacy club ids.** `rutina.json` files authored before this feature reference a gym by a small integer (1–7, the old hand-entered Malaga list). `gym-scrape-core.js`'s frozen `LEGACY_CLUBS` table maps each of those integers to the 32-hex club GUID that the new scraper produces, so old files keep validating unmodified. **Six of the seven are still structurally-valid placeholders**, not real GUIDs. The seventh (`1ec43550fd654c7d8e23bc6c96cd2ff0`, `legacyId: 3`) was believed verified as "Málaga Alameda," but a direct check against the live storefront during this build found it now resolves to a *different* real club — "A Coruña Avd. Salvador de Madariaga." No test currently catches this (the resolution test only asserts `club.id`, not name/city), so a `rutina.json` with `gymId: 3` imports without error but resolves to the wrong club. Getting all 7 legacy ids onto correct, verified GUIDs is open follow-up work, not something to treat as already done.

## Using the PWA

**First launch:** if there's no active rutina yet, a short onboarding carousel introduces what Rutina does and the LLM generate-then-import workflow, then asks for your gym (via the Club Picker), your program's name and goal, your weekly schedule, and any injuries or movements to avoid — one guided step per field, each explaining what the field is for and showing an example. **Every step is skippable**, including all the input ones, and answering none of them still finishes onboarding normally. There is no separate Settings entry for these answers afterward: the one place to review or change them is step 1 of the prompt wizard (Import → **Preparar prompt**), which opens pre-filled as **Revisa tus respuestas** (see "Authoring a Rutina with an LLM" below). A small on-demand control keeps onboarding reachable if you want to revisit it later; subsequent app opens skip straight past it.

1. **Import a rutina** — paste a `rutina.json` or upload a file; an import **adds** a rutina to your library rather than replacing what's there (see "Mis rutinas" below). Use `data/examples/phase1-monday.json` to try the flow immediately. Generate your own with the LLM workflow below.
2. **Home** — proposes your **next** workout: the day after the one you most recently *completed*, wrapping back around to the first day after the last — and falling back to the very first day until you complete something (abandoned attempts don't advance the proposal). The proposal ignores the calendar and the day labels' language entirely; it reads only your **active rutina's** completed-session history, so switching to a different rutina switches the proposal with it. The proposed day sits on a card labeled **Próximo** with an **Empezar entrenamiento** button. If the active program has more than one day, an **Elegir** toggle under that button expands every day of the routine in program order, each row with its exercise count; the auto-proposed one is tinted purple and tagged **Próximo**, and tapping any row starts that day immediately (your pick isn't remembered — once you complete a session, the rotation simply continues from there). With a club-access link saved (**Club access link** below), an outline **Acceso** button (with a QR-code icon) is pinned to the bottom of the screen just above the tab bar — on both the idle screen and the EN CURSO screen — and opens the saved link in a new browser tab while the app itself stays put: same route, same scroll position, any in-progress session still running when you come back. No link saved means no button rendered at all — its absence means you haven't configured one, not that something broke. Below that, an **Últimas sesiones** section lists your two most recent sessions (newest first; abandoned ones keep their "sin terminar" marking). While a session is in progress, Home shows an "EN CURSO" card describing *that* session instead — its own day and `X / Y completados` — with a **Reanudar entrenamiento** button rather than "Empezar entrenamiento"; this holds from the first paint (a skeleton, not a start button, while the check is in flight), so you can't accidentally start a second session on top of one already running. If the check itself fails, Home shows an error with a **Reintentar** button instead of silently offering to start. A purple **"Entrenamiento en curso"** banner — showing the day and progress — sits at the top of every other tab (Programa, Catálogo, Historial, Progreso, Exportar) and jumps back into the session when tapped; it's hidden on Home itself, on the session screen, and during import, and it disappears the moment the session is finished, stopped, or discarded.
3. **Program** — full routine view across all days. A single **Mis rutinas** action opens the rutina library (see below).
4. **Active session** — tap a day on Home to start. Log weight + difficulty per exercise; the weight field is prefilled with the last weight logged for **that exact exercise**, not for the machine, so two different exercises sharing one piece of equipment (e.g. a chest press and a shoulder press on the same station) keep independent suggested weights and independent history. Right after updating to this version the field starts out empty for every exercise — the caption reads "Sin registros de este ejercicio todavía." — and fills in again the next time you log each one; older sessions aren't backfilled, and that caption is the only explanation you'll see (there's no separate one-time banner). Tapping an exercise's equipment row opens a sheet with a **"Ver técnica de «*exercise name*» en YouTube"** link — the tutorial is scoped to that exercise, not the machine in general, so two exercises sharing one station link to two different searches; the machine's own reference video has moved to the **Catálogo** tab. End the workout one of three ways: **Finalizar sesión** (saved as completed), **Sesión terminada sin completar** (saved as abandoned — still shows up in History as an unfinished session), or **Descartar sin guardar** — a separate, low-emphasis danger action set apart from the other two by hairline dividers, so it can't be mistaken for either save option. Discarding asks "¿Descartar el entrenamiento?", states plainly that nothing will be saved (including any weights already logged) and that it cannot be undone, and only proceeds if you confirm.
5. **History** — past sessions with per-exercise last-3-sessions weight trend, drawn from **all** your rutinas newest-first. Once your history spans more than one program, every card gains a muted attribution line naming the program (and phase) the session came from — including programs you've since deleted from the library — and a **Filtrar por programa** pill row appears so you can view just one program's sessions; it's a view filter only (the stats stay global) and resets when you leave the screen. Each card has its own delete (trash) icon; a **Seleccionar** button in the header switches to selection mode, with **Seleccionar todo** to select everything and a **Borrar (n)** bar to delete the checked sessions in one go. Both single and bulk delete ask for confirmation first and cannot be undone. Deleting a session also rolls back any weight prefills it seeded: the next time you log that exercise, the suggested starting weight falls back to your most recent remaining session instead.
6. **Progress** — fifth bottom tab after History: per-exercise weight chart (full history), per-session volume bars (each session's planned sets×reps, snapshotted at log time × logged weight, in kg: a rep range counts its lower bound — "10-12" is 10 — while timed holds ("30s") and free text ("AMRAP") count 0, so a hold-only session is a zero bar rather than a blank chart; each bar shows its value above and its date below, with a one-line caption under the heading restating the formula, and the same text is read out per bar to screen readers — sessions old enough to predate those snapshots are computed against the active rutina while it's active and excluded from the chart entirely once it isn't, rather than drawn as zero bars), and a trailing 12-week training-frequency heatmap — all derived from existing session history across all your rutinas (no new store). Volume for older sessions can shift if you later edit the sets/reps of the rutina they belong to.
7. **Export** — download a JSON archive or copy Markdown to clipboard. Optional Web Share on mobile. See [`docs/export-format.md`](docs/export-format.md) for the exact format.
8. **Catalog** — all 48 equipment items (29 machines, 14 free weights, 5 accessories) with images and instructions (EN/ES/BE/FR/NL/DE). Once you've chosen a club (in **Settings → Mi club**, see "Selecting your club" below) the Catálogo tab gets two club aids: a **"Solo mi club"** filter pill, and a chip under each equipment card — **En mi club** / **Fuera de mi club** — that includes or excludes that item from your club with one tap. Picking the club and editing the whole equipment list at once live in Settings, not here; with no club chosen the Catálogo tab shows neither the pill nor the chips.

### Mis rutinas — your rutina library

The app holds any number of imported rutinas side by side; exactly one is **active** — it's the one Programa renders, Home proposes from, and new sessions attribute themselves to. Open the library from the **Programa** tab's **Mis rutinas** action. Every entry lists its name, phase, and day count, with the active one tagged **Activa**; **Activar** swaps the active rutina instantly across every screen, no reload needed. Deleting a rutina never touches its history — its sessions stay in Historial under that rutina's name (see History above) — and deleting the *active* rutina asks which of the remaining ones should take over (**Eliminar y activar…**); removing your very last rutina returns the app to the import screen. If a workout is in progress when you switch, the app warns you first that the running session will stay linked to its original rutina. Importing while the library already has entries adds to it without changing what's active: the success panel offers **Activar ahora** or **Guardar sin activar** — an empty library still activates silently, so a first run behaves exactly as it always has. If you used an earlier single-program version of the app, a one-time notice on **Programa** («Tu programa ahora vive en Mis rutinas.») simply points here — nothing moved, nothing lost.

All data is stored locally in your browser — IndexedDB for routines and sessions, browser settings storage (`localStorage`) for configuration like your club pick, UI language, and saved club-access link — no account, no server. Nothing leaves the device unless you explicitly export or share a file: a backup (below) is one such file, a plain-text JSON you download and keep wherever you put it, and if you've saved a club invite link it travels inside that file too — disclosed in-app as a bearer capability before every download, because whoever opens the file can use it to enter your gym.

### Copia de seguridad y restauración

PWA storage is **not permanent** — a browser "clear site data", switching browsers, moving to a new phone, or an iOS PWA left untouched for about a week can all wipe IndexedDB and `localStorage` with no warning. A backup is the only way to get your data out of one device and back into another.

Open **Settings** (the sliders icon in the header) → **Copia de seguridad**:

- **Descargar copia completa** — downloads `rutina-backup-YYYY-MM-DD.json`: every rutina in your library, the active pointer, every session (including abandoned ones), your per-exercise working weights, and the handful of app settings above. The section states plainly first: *"La copia contiene todo: rutinas, sesiones y ajustes. Restaurar REEMPLAZA lo que hay en este dispositivo. Funciona sin conexión."* If a club invite link is saved, an extra line warns it's included: *"El archivo incluye el enlace de acceso al club — quien lo tenga puede entrar al gimnasio. Trátalo como una llave."*
- **Restaurar copia…** — pick a previously downloaded backup file. The same control also appears as a ghost button on the empty **Import** screen, for the moment you actually need it most: a new phone with nothing imported yet.

Restoring shows exactly what the file contains (rutina/session counts, export date) and, when the device already has local data, **exactly what will be lost** — e.g. *"Se BORRARÁ lo actual de este dispositivo: 34 sesiones y 2 rutinas. Esta acción no se puede deshacer."* — before asking you to confirm. **Restore replaces, it does not merge**: confirming wholesale-overwrites the current library, sessions and working weights with the file's contents; there is no partial or selective restore. Restoring onto an empty install (nothing to lose) skips the loss warning. A file from a newer app version is rejected with a message asking you to update first, never partially applied; a mid-restore failure leaves your existing data untouched.

This is a different file from the **Exportar progreso** JSON/Markdown export (step 7 above) — see [Backup Format Reference](docs/backup-format.md#the-two-exports) for the full comparison. Short version: the progress export is a lossy, human-readable digest meant for pasting into an LLM chat and cannot be re-imported; the backup is a complete, lossless, restorable copy of everything the app knows, meant for moving between devices or surviving storage loss.

### Selecting your club

One club selection, stored locally (`localStorage`, key `rutina:club`) so it survives a reload without asking again. Three places can set it; **Settings → Mi club** is the one home for managing it:

- **Settings → Mi club** — the last section on the Settings screen (sliders icon in the header). It shows your club's name and address the moment the screen opens; with no club chosen it says «Aún no has elegido tu club.» and offers **Elegir club**, otherwise **Cambiar club**. Both open the picker below.
- **Onboarding** — the "your gym" step of the first-launch carousel.
- **Prompt wizard, step 2** (Import → Preparar prompt) — the club row above the prompt preview, with **Cambiar** / **Elige tu club**.

The Catálogo tab no longer has a club row or a picker; it only reads the club you chose elsewhere. (Upgrading needs no action: your stored club and equipment exclusions are untouched, only where you edit them moved.)

The picker is three dependent fields — **country → city → club** — each filterable as you type, keyboard- and screen-reader-navigable. Picking a country enables the city field; picking a city enables the club field, listing every club in that city by name and street address (address is shown because a meaningful share of club names *are* their street, so the address is what actually disambiguates them). If your club isn't listed, the empty-results state links straight to the guide's free-text field so you're never blocked.

Once a club is selected:

- **Settings → Mi club → Equipo del club** — an entry row under the club name, with a count hint such as «48 equipos · 3 marcados como ausentes» (just «48 equipos» for the instant before your saved list has loaded). It opens the **Equipamiento de tu club** sheet: untick items your specific club does not have. The list is saved per club in IndexedDB (`clubEquipment` store) and survives a reload. The row is absent until a club is chosen — there is nothing to edit without one.
- The Catálogo tab's **"Solo mi club"** pill filters the grid to that club's equipment (using your saved exclusions). It appears only once a club is chosen, is on by default, and does nothing until you have excluded at least one item.
- Every card in the Catálogo tab gets a chip beneath it — **En mi club** or **Fuera de mi club** — that flips that one item in the same saved list the Settings sheet edits (one list, two editors; a change made in one shows in the other the next time you open it). With the pill on, every visible card is in your club, so tapping a chip excludes the item and its card leaves the view. With the pill off you see the whole catalog: excluded items are dimmed, read **Fuera de mi club**, and one tap adds them back.
- If the pill leaves nothing to show — typically because you excluded the last item — the grid is replaced by a message: «Has marcado todo el equipo como ausente de tu club. Desactiva «Solo mi club» para ver el catálogo completo, o edita las exclusiones en Ajustes.» When a chip tap empties the grid, keyboard focus moves to the pill so the way back is one keypress.
- If saving fails, the toggle still applies immediately and a single note, «No se pudo guardar — los cambios se mantienen en esta sesión», appears above the grid (or inside the equipment sheet). The change is kept for the current session only.
- The wizard's copied prompt embeds a club-scoped equipment table (all 48 items minus your exclusions, grouped by kind: machines / free weights / accessories) and pre-fills field 6 with your club's name, city, and address automatically. No manual gym-id lookup needed.

### Club access link

This is different from club *selection* above — nothing here changes which equipment the Catálogo tab filters. It's about getting *into* the gym: Basic-Fit members can share a **friend invite** link whose page shows a QR code that opens the club gate. If someone shared one with you, save it once in the app instead of digging it out of a chat at the door.

Open **Settings** (the sliders icon in the header) and find the **Acceso al club** section. A one-line explainer right under the heading says who the field is for: **«¿Sin suscripción propia? Si un amigo te compartió su invitación, este enlace abre al instante el código QR de acceso al club.»**

1. Paste the invite URL into the **Enlace de invitación** field. The paste doesn't have to be just the link: surrounding message text is fine — the app finds the `https://` link inside it, strips any trailing punctuation (a sentence-final dot, a closing parenthesis), and saves that bare link, putting it back into the field so you see exactly what was kept. If the text happens to contain several links, the first one wins. Text without any link in it behaves as before: rejected with a message naming what was wrong, nothing stored. Only well-formed `https://` links are accepted — `http:` and every other scheme get the same rejection — and a failed save never destroys an already-saved working link.
2. Tap **Guardar**. While a link is stored, the **Guardado:** line underneath always shows the saved value — the exact address the Inicio button will open — even if you're mid-edit on a replacement.
3. To swap invites, paste the new one over the pre-filled field and tap **Guardar** again. To remove the link entirely, tap **Eliminar**; Inicio goes back to not showing the button.

The app treats the link as an opaque string and nothing more: it never renders the QR code, never fetches the page, and has no way to check whether the link still works — saving succeeds for any valid `https://` address, and whether it actually opens your club's gate is something you find out at the gate. This is not a Basic-Fit integration either: no account link-up, no membership management. What happens to the link is stated under the field, verbatim:

> Se guarda solo en este dispositivo; la app nunca lo envía a ningún sitio. Cualquiera con este enlace puede entrar al club. La app no puede comprobar si el enlace sigue válido.

That second sentence matters — anyone you forward the link to can enter the club too, so treat it like a key. And if the browser blocks storage (some private-browsing modes), **Guardar** reports the failure plainly instead of pretending the link was saved. On **Inicio**, a saved link adds an outline **Acceso** button (with a QR-code icon) pinned to the bottom of the screen just above the tab bar; see step 2 of "Using the PWA" above.

## Languages

The app distinguishes three things that used to be silently conflated as
"the app is in Spanish" — telling them apart is the point of this section,
because conflating them is exactly what caused the two bugs described below.

| # | Axis | Controlled by | Lives in | Behavior |
|---|------|----------------|----------|----------|
| 1 | **UI chrome** — labels, buttons, headings, aria-labels, empty states, errors, onboarding, the LLM guide sheet and prompt wizard | The app | `app/src/i18n/{es,en,be,fr,nl,de}.js` | `es` / `en` / `be` / `fr` / `nl` / `de`, switchable from **Settings** (the sliders icon + language code in the header) or from the onboarding language picker on first run. Persisted in `localStorage`. First run defaults from the browser: `es`/`be`/`fr`/`nl`/`de` → that locale, anything else → `en`. |
| 2 | **Bundled reference data** — equipment names, descriptions, instructions, video links | The app | `data/equipment.json` (`{en, es, be, fr, nl, de}` per field) | Follows the UI language everywhere in the app, with a local, non-persisted override on the **Catálogo** tab's `Idioma del contenido` select. |
| 3 | **User-authored routine content** — exercise names, day labels, technique cues, rules, notes, phase objectives | The user, via whatever LLM they used | Imported `rutina.json` | Rendered **exactly as authored, in whatever language it was written in.** Never translated, never validated for language, never assumed to be Spanish. |

Axes 1 and 2 are a translation problem the app solves for you. Axis 3 is
different on purpose — the app has no idea what language your routine text
is in, and must not guess. Before this was made explicit, that guess was
implicit and wrong in two places:

- A non-Latin exercise name (Cyrillic, Greek, CJK, Arabic, Hebrew…) used to
  slug to an empty string, so two differently-named exercises on the same
  machine silently shared one history — weights, trends, progress charts and
  export all merged — and a non-Latin bodyweight exercise couldn't be
  tracked at all.
- "Today's session" used to be resolved by matching the day label against a
  hardcoded **Spanish** weekday list. An English- or Belarusian-authored
  routine silently fell out of "today's session" into a weaker
  "guess from history" fallback, with no error or warning.

Both are fixed at the library level (`app/src/lib/exerciseKey.js`, covered
by tests) — and the session side has since been settled more decisively
still: Home's proposal no longer matches day labels against anything
(`app/src/lib/nextDay.js` rotates purely from completed-session history),
so routine-language can't influence it at all. But the underlying rule is
the one worth remembering when touching either axis: **code for axis 1/2 may
assume a language; code that touches axis 3 never may.**

Switching the UI language (axis 1) is immediate — no reload, no navigation,
no lost session or scroll position. Weight units always stay `kg` regardless
of language; that's a units question, not a translation one.

## Authoring a Rutina with an LLM

Training programs are authored by pasting a ready-made prompt into any LLM chat — no coding required, and no 8-field checklist to fill in by hand anymore.

On a fresh install (empty library) the Import screen opens on a fork: **Preparar prompt** (recommended), **Ya tengo un rutina.json**, or **Restaurar copia…**. Step-by-step: [`docs/first-run-create-rutina.md`](docs/first-run-create-rutina.md).

1. **Preparar prompt** opens a two-step wizard. Step 1 collects goal, days/week (1-7), session length and injuries (program name is under **Más opciones**; pre-filled as a review if onboarding already answered) — every field optional.
2. Step 2 composes the full prompt — your club's equipment list plus the rutina JSON Schema **inlined as literal text**, nothing to fetch or attach — with a preview, **Copiar prompt**, three on-screen instructions, and a **Guía completa** sheet. (A single `rutina.schema.json` download remains as a fallback for chats that truncate a long paste — see the guide's Troubleshooting section.)
3. Paste the prompt into any LLM, then **Ya tengo el JSON →** to reach the JSON screen (paste or choose a file; **Cargar ejemplo** for a sample). Or validate locally: `npm run validate-rutina -- path/to/rutina.json`
4. If validation fails, press **Copiar errores**, paste the text back to the LLM and re-import.

With a non-empty library the fork is skipped and Import opens on the JSON screen. The guide screen's former editable form and prompt textarea are gone: the wizard replaces them.

When repeating this for a second phase, the wizard's copy step fills field 8 for you automatically from your logged session history (a checkbox, on by default, lets you leave it out) — the LLM uses it to understand what actually happened (weight progression, difficulty, abandoned sessions). You can also plan further ahead: ask the LLM for a multi-phase program and import each phase as its own `rutina.json` — the phases stack up in **Mis rutinas**, ready to activate one after another. See [`docs/export-format.md`](docs/export-format.md) for the exact format.

Full walkthrough (shown in-app via **Guía completa** in the wizard) — pick your language:

| Language | Guide | Prompt template |
|----------|-------|-----------------|
| English | [`docs/llm-rutina-prompt.en.md`](docs/llm-rutina-prompt.en.md) | [`docs/llm-rutina-prompt-template.txt`](docs/llm-rutina-prompt-template.txt) |
| Español | [`docs/llm-rutina-prompt.es.md`](docs/llm-rutina-prompt.es.md) | (same template) |
| Беларуская | [`docs/llm-rutina-prompt.be.md`](docs/llm-rutina-prompt.be.md) | (same template) |

The guide ships in these three languages only. A UI set to Français, Nederlands or Deutsch gets the English article — the guide falls back to English when no translated guide exists — while every other part of the app renders natively in all six locales.

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
  "names": { "en": "Chest Press", "es": "Prensa de Pecho", "be": "Жым ад грудзей", "fr": "Presse à poitrine", "nl": "Borstpers", "de": "Brustpresse" },
  "images": [{ "url": "https://images.jhtassets.com/...", "isMain": true }],
  "instructions": {
    "en": "<ol><li>Step 1</li></ol>",
    "es": "<ol><li>Paso 1</li></ol>",
    "be": "<ol><li>Крок 1</li></ol>",
    "fr": "<ol><li>Étape 1</li></ol>",
    "nl": "<ol><li>Stap 1</li></ol>",
    "de": "<ol><li>Schritt 1</li></ol>"
  },
  "kind": "machine",
  "verifiedAt": []
}
```

`gymZone` and `gyms` (a fixed 1–7 club-id array) were removed — a piece of equipment is no longer assumed present at every club by category. `verifiedAt` replaces it: an array of 32-hex club GUIDs where this item has actually been confirmed present. It's `[]` on every entry today (nothing has been confirmed yet) — an honest default, not a placeholder to fill in blindly. `kind` is the physical-type discriminator (`machine` / `free-weight` / `accessory`, optional, defaults to `machine`) used to group the in-app equipment overlay; it's a different axis from `category` — two entries (`G3-MS24`, `MG-PL13`) are `category: "free-weights"` but `kind: "machine"`, because that's the club zone they physically stand in even though they aren't loose weights.

### Rutina entry (abbreviated)

```json
{
  "meta": { "name": "Phase 1", "language": "es", "goal": "strength" },
  "program": { "gymId": 3 },
  "days": [
    {
      "label": "Lunes",
      "exercises": [
        { "equipmentId": "g3-s10", "sets": 3, "reps": "10", "restSeconds": 60 },
        { "equipmentId": "resistance-band", "sets": 3, "reps": "15-20", "restSeconds": 45 },
        { "equipmentId": null, "sets": 3, "reps": "30s", "restSeconds": 45 }
      ]
    }
  ],
  "extraEquipment": [
    { "id": "resistance-band", "kind": "gear", "names": { "en": "Resistance Band", "es": "Banda de Resistencia", "be": "Эластычная стужка" } }
  ]
}
```

Three things changed on the rutina side:

- **`program.gymId`** now accepts *either* the legacy small integer (1–7, the original hand-entered gyms) *or* a 32-hex club GUID from the scraped `data/gyms/<CC>.json` directory — both resolve to a real club, so a `rutina.json` exported before this feature keeps validating unmodified.
- **`exercises[].equipmentId` is optional and nullable.** Omitted or `null` means a bodyweight exercise (like the plank above) — the UI shows just the exercise name, and it is not a validation failure or a broken lookup.
- **A new root-level `extraEquipment[]`** array lets a rutina declare gear the catalog doesn't carry (a resistance band, a foam roller — no manufacturer identity). Each entry needs a kebab-case `id` that doesn't collide with a catalog id, a `kind` that's always the literal string `"gear"` (equipment.schema.json deliberately rejects `"gear"` as a `kind` value — the two schemas disagree on that one string on purpose), and trilingual `names`. An exercise's `equipmentId` can point at either the catalog or `extraEquipment[]` — they share one id namespace for lookup purposes.

Full schemas: `data/schema/equipment.schema.json` and `data/schema/rutina.schema.json`. The full-data backup has its own envelope schema, `data/schema/backup.schema.json` — see [Backup Format Reference](docs/backup-format.md).

## Equipment Catalog

48 items across 8 `category` values (the `category` filter pills in the Catálogo tab) — the original 6 machine-room categories, plus two added by this feature:

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

### Free weights (16)
G3-MS24 Aura Adjustable Pulley · MG-PL13 Magnum Supine Bench Press · ZVO-DBPU-1648 Solid Steel Urethane Dumbbells · ZVO-PUTF-3078 Urethane Functional Tribells · ZVO-BSPU-1619 Solid Steel Urethane Barbells · ZVO-BCPU-1606 Solid Steel Urethane EZ Curl Barbells · ZVO-DCPU-1616 Urethane Grip Discs · ZMT-CTKB-5626 Signature Steel Competition Kettlebells · ZVO-LBHC-2953 Olympic Bars · ZVO-HCOB-2966 Olympic EZ Curl Bar 1.2m · ZFT-HCOB-2965 Olympic Tricep Bar 76cm · ZVO-PBHC-2936 Olympic Hex Trap Bar · ZVO-PBHC-2933 Multi-Grip Swiss Bar · ZEX-ICBP-TP08 Olympic Incline Bench · ZEX-XFID-6762 F-I-D Bench 2.0 · ZEX-XFLT-6752 Flat Bench 2.0

Two of these (`G3-MS24`, `MG-PL13`) are `kind: "machine"` despite living in the `free-weights` category — see the `kind` vs `category` note in Data Format above.

### Accessories (5)
ZSL-TDYM-0250 TPE Deluxe Yoga Mats · ZVO-SPSB-6882 Slam Balls · ZVO-SPPB-6387 Premium Power Core Bags 2.0 · ZMT-GLPY-5671 Glute Plyo Box · ZVO-BUBL-0564 Balance Ball 2.0

## Gym Locations

The 7 originally hand-entered Málaga gyms below are `data/gyms.json`'s legacy list, kept for legacy `rutina.json` files whose `gymId` is a small integer (see "Legacy club ids" above). **For anything current, use the PWA's Club Picker** ("Selecting your club" above), which searches the full 1,727-club, 6-country directory in `data/gyms/`.

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
2. Follow the existing structure (content required in all six locales: EN/ES/BE/FR/NL/DE). Belarusian, French, Dutch and German content is always hand-authored — never scraped or machine-translated, even when the `en`/`es` content comes from a live product page.
3. Run `npm run validate-data` — must pass
4. Run `npm run normalize-equipment` to apply the standard fixups (video-placeholder resolution, dead manual-URL rewriting). It's a no-op if there's nothing to fix.

### Adding or changing a UI string

UI copy lives in `app/src/i18n/{es,en,be,fr,nl,de}.js` — flat, dotted-key objects
(e.g. `'settings.title': 'Ajustes'`), not nested. To add or change one:

1. Add or edit the key in **all six** catalog files. `catalogs.test.js`
   fails if the six files' key sets don't match exactly, or if any value
   is empty/whitespace-only — this is enforced, not just requested.
2. Library functions that produce copy outside React (`relativeTime.js`,
   `exportFormat.js`, `machineLabel.js`, …) take an optional trailing `t`
   (or `lang`) argument that defaults to the Spanish-pinned translator
   (`defaultT`, exported from `app/src/i18n/index.js`). A call site that
   doesn't pass one keeps getting Spanish, which is what lets the app's
   ~124 pre-existing Spanish-literal test assertions keep passing
   untouched. Follow the same pattern for any new function that emits
   user-visible text.
3. `app/src/i18n/strayLiterals.test.js` scans `app/src/**/*.{js,jsx}` for
   Spanish-looking string/JSX literals left outside the catalogs, as a
   regression tripwire (heuristic, not a proof — it won't catch
   everything). A literal that legitimately isn't translatable copy (a
   `localStorage` key, a filename) goes in that file's `ALLOWLIST` array
   with a one-line reason — never a silent dumping ground.
4. If you edit `docs/llm-rutina-prompt.{es,en,be}.md`, run
   `npm run build-guide` afterward — the in-app guide sheet reads a
   generated `app/src/data/guideContent.js`, not the Markdown files
   directly, and it will silently go stale if you skip this.

## License

For personal use. Equipment specifications and names are based on publicly available Matrix Fitness and ZIVA documentation.

## Resources

- [Matrix Fitness](https://www.matrixfitness.com/)
- [BasicFit](https://www.basic-fit.com/en-es/gyms)
- [Matrix Manuals](https://jhtsupport.com/eng/matrix/manuals/)
