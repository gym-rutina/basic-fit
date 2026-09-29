# Basic-Fit Design System

A design system for building **training-routine SPAs** (rutina pages, equipment catalogs, and future workout tools) in the visual language of Basic-Fit — Europe's largest budget gym chain (1600+ clubs, 24/7, "make fitness Básic").

## Context & sources

- **Brand reference:** https://www.basic-fit.com/es-es/home (public marketing site, es-ES locale). Palette, tone and layout conventions were derived from it.
- **Attached codebase:** `basicfit-rutina/` (local mount) — a personal multilingual (EN/ES/BE) toolset for BasicFit gyms:
  - `equipment-catalog.html` (historical) — the filterable catalog of 27 Matrix Aura machines this design system's `EquipmentCard`/catalog patterns were originally derived from (language switch EN/ES/BE, category filters, equipment cards with images, muscle tags, instructions, video/manual links, gym badges). **Deleted from the source repo** in the 2026-08-09 gym-directory-and-catalog feature — its 48-item, 8-category successor now lives only in the PWA's `app/src/screens/CatalogScreen.jsx` + `EquipmentCard.jsx`. The patterns below still hold; the file they were traced from no longer exists on disk.
  - `data/equipment.json`, `data/gyms.json`, `data/user-weights.json` — the data model these apps embed.
- Equipment imagery comes from the Matrix CDN (`images.jhtassets.com`); it is hot-linked, not stored locally.

**This design system's component inventory = the UI patterns of those two apps**, restyled from their original generic purple-gradient theme into Basic-Fit's brand, plus the layout conventions of basic-fit.com.

## Content fundamentals

- **Primary language: Spanish (es-ES)**, with the routine apps pairing ES + BE instructions side-by-side and offering EN/ES/BE switching. Design for multilingual text lengths.
- **Direct, informal "tú".** Basic-Fit speaks to you: "Empieza por solo 9,99 €", "Únete al club que te sienta bien", "Entrena a cualquier hora". Imperative verbs open sentences: *Empieza, Entrena, Descúbrelo, Encuentra*.
- **Casing:** headings are sentence case in copy ("Encuentra tu club") but rendered visually in UPPERCASE via CSS; plan names and CTAs are lowercase ("comfort", "premium", "empezar", "ver precios").
- **Short, benefit-led bullets:** "Siempre cerca de ti", "Mejor calidad-precio". No jargon; encouraging, never drill-sergeant.
- **Numbers do the selling:** "1600+ clubes", "24/7", "9,99 €". Big stat + small qualifier is a recurring pattern.
- **Emoji:** the source routine apps use emoji as functional icons (💪 🏋️ 📅 🔥 ❄️ 📈 📊 📹 📍). The brand site does not. This system keeps emoji as an *optional* icon substitute for personal-tool surfaces; see ICONOGRAPHY.
- **Instructional copy** is numbered ordered lists, one action per step, formal-polite in ES ("Siéntese…" in machine instructions) — mirrors Matrix manuals.

## Visual foundations

- **Color:** white pages with warm **sand** (`#E8D7C1`) content bands and **cream** (`#FBF7F0`) menu/utility surfaces; near-black ink (`#2D2D2D`); TWO accents: Basic-Fit orange `#F36F21` (brand — logo, hero surfaces, active filter chips, highlight words, arrows) and action purple `#5B21AC` (buttons, links, focus) with **deep purple `#2E055F`** for nav underlines/active markers. Orange is never a button color; purple is never a brand surface. Semantic green/blue/red only for status. Gradient only on the orange hero (`#F98A2B → #D66D23`).
- **Type:** heavy grotesque display in UPPERCASE for H1/H2 (Archivo Expanded 800 — substitute, see below); regular Archivo for everything else. Big bold stats (`--text-stat`). Small labels are 12px, 600, uppercase, tracked +0.08em.
- **Layout:** max 1200px content column, 20px gutters; full-bleed grey/ink bands for section rhythm; sticky top nav; fixed back-to-top FAB bottom-right. Card grids `repeat(auto-fill, minmax(…, 1fr))`.
- **Corners: NOTHING is pill-shaped or heavily rounded.** Cards, panels and photos are sharp rectangles (`0`); chips/inputs `4px` with a 1px ink border; buttons `6px`; tags/badges `2px`. `--radius-pill` is legacy — do not use.
- **Cards:** sharp white rectangles that **overlap photos** (article pattern: photo, then white card shifted up over its bottom edge) on sand bands; "Leer más" links end with a diagonal orange arrow.
- **Hover:** darker purple on primary buttons; purple-tint fill on outline/ghost; cards lift 2px with `--shadow-raised`. **Press:** darken further, no shrink transforms. Focus: 3px purple ring.
- **Motion:** quick functional ease-out fades/lifts (120–200ms). No bounces, no infinite loops.
- **Imagery:** real photography — warm, energetic in-gym shots with orange ambient accents (per basic-fit.com). Equipment photos are white-background Matrix product shots. No illustrations, no drawn graphics. B&W is not used.
- **Backgrounds:** flat color only (white / grey-1 / ink). Photography is used as content blocks, not as text backdrops; when text must sit on photos, use a solid ink panel, not a protection gradient.
- **Navigation:** horizontal menus are white bars with ink links and a **4px deep-purple underline** on the active/hovered item — never pill backgrounds. The mobile menu is a cream drawer with dotted separators, a 3px purple left bar on the active item and arrow-right glyphs for submenus.
- **Dark surfaces:** the footer is the main ink surface (white text, orange logo). Page headers are white with breadcrumb + uppercase ink title; colored banner blocks are the exception (highlights), not the rule.
- **Buttons:** rectangular 6px radius, bold UPPERCASE labels: primary = solid purple, outline = white + purple border/text, secondary = solid ink, inverse = white (for orange/ink surfaces). Filter chips: white, 1px ink border, 4px radius; active = solid orange with white text.
- **Hero surfaces:** the homepage hero is a full-bleed orange gradient with a white dot-pattern accent and a diagonal-cut photo carrying an italic white uppercase slogan; content cards (club finder) overlap it.
- **Logo:** official SVG hot-linked from the Basic-Fit CDN (`logo-bf-orange.svg`); no local copy could be fetched — falls back to a plain-type wordmark offline.

## Iconography

- **No icon files exist in the sources**, and the source routine apps used emoji as icons — we replaced this. Policy: **use the thin-line `Icon` component** (`components/core/Icon.jsx`, a Feather/Lucide ISC subset that matches basic-fit.com's line-icon style, ~2px stroke, currentColor). **Never use emoji as icons.** Unicode arrows/glyphs also replaced (back-to-top uses `arrow-up`, checklists use `check`).
- This is a flagged substitution: Basic-Fit's real icon set was not available as files. If you can provide the site's SVG icons, drop them into `assets/icons/` and we'll switch `Icon` to use them.
- **No logo asset is included.** The Basic-Fit logo is a trademarked wordmark and was not provided as a file; components render the brand name in plain type (`Basic-Fit` in the display face) wherever a mark would go. Supply official logo files to replace this.

## Font substitution — FLAG

Basic-Fit's proprietary web typeface was not provided. **Archivo / Archivo Expanded (Google Fonts)** is used as the nearest match (heavy grotesque, sporty). Please supply official font files (woff2) and we'll swap `tokens/fonts.css` to real `@font-face` rules.

## Index

- `styles.css` — global entry; imports everything under `tokens/`.
- `tokens/` — `colors.css`, `typography.css`, `spacing.css`, `effects.css`, `fonts.css`, `base.css`.
- `guidelines/` — foundation specimen cards (Design System tab).
- `components/` — organized by composition tier, not by page domain:
  - `primitives/` — single-purpose atoms, used everywhere: Button, Badge, Tag, FilterPill, Icon, StatCard, DetailItem, NoteItem, RuleItem, BackToTop, CheckList, StepHeader, ChoiceCard
  - `composite/` — assembled from primitives into reusable units: EquipmentCard, ExerciseCard, SectionBanner, SummaryTable, Accordion, ArticleCard, PriceCard, NavMenu
  - `sections/` — large, page-level blocks (site chrome, hero, full-bleed content bands): SiteHeader, Hero, ClubFinder, FeatureSplit, MobileMenu, PageHeader, PageFooter
- `ui_kits/rutina/` — interactive recreation: routine page + equipment catalog, rebranded.
- `templates/` — starting templates for consuming projects.
- `SKILL.md` — agent skill entry point.

### Intentional additions
None beyond the source inventory. All components map 1:1 to patterns in `rutina_*.html` and (historically) `equipment-catalog.html` — see the provenance note under Context & sources above; the equipment-catalog patterns now live on in the PWA's `CatalogScreen.jsx` + `EquipmentCard.jsx` instead of a standalone HTML file.
