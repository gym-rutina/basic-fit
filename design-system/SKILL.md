---
name: basic-fit-design
description: Use this skill to generate well-branded interfaces and assets for Basic-Fit training-routine apps (rutinas, equipment catalogs, workout tools), either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, and UI kit components for prototyping.
user-invocable: true
---

Read the README.md file within this skill, and explore the other available files.
If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.
If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.

Key facts:
- Global CSS entry: `styles.css` (imports `tokens/*.css`). One accent color: Basic-Fit orange `#F36F21`; ink `#262626`; grey-1 `#F5F5F5` sections. No gradients.
- Type: Archivo / Archivo Expanded (Google Fonts substitute — official brand font not available). H1/H2 uppercase 800.
- Buttons are lowercase pills. Cards: 12px radius, 1px #EBEBEB border, whisper shadow.
- No logo file exists: render "Basic-Fit" in plain display type; never draw the logo.
- Components live in `components/{primitives,composite,sections}/`; full-screen examples in `ui_kits/rutina/`.
- Primarily mobile: design at ~390px width first; grids use auto-fit minmax.
