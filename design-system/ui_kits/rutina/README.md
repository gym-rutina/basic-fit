# UI Kit — Rutina App (Basic-Fit)

Interactive, mobile-first recreation of the two surfaces in `basicfit-rutina/`, rebranded from their original purple-gradient theme into the Basic-Fit design system.

- `index.html` — entry; ink top bar switches between the two screens (persisted in localStorage).
- `RoutineScreen.jsx` — training routine page: ink hero + phase badge, sticky section nav, phase objectives banner (success), warmup (brand), day section with 3 ExerciseCards (parameters, equipment, technique steps, video links), cooldown (info), weekly SummaryTable, rules + notes, ink footer, BackToTop.
- `CatalogScreen.jsx` — equipment catalog: hero, functional EN/ES/BE language switch and category filters (FilterPill), live count of the filtered equipment, responsive EquipmentCard grid.
- `kit-data.js` — abbreviated dataset (6 of 27 machines) lifted from `data/equipment.json`; machine photos hot-linked from the Matrix CDN.

Content is abbreviated deliberately (1 of 3 days, 6 of 27 machines); structure covers every component family in the source apps.
