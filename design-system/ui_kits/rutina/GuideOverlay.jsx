const DSGuide = window.BasicFitDesignSystem_1cb8a2;
const { Icon: GuideIcon } = DSGuide;

/* ─── i18n ──────────────────────────────────────────────────────────────── */

const GUIDE_TITLE = {
  es: "Guía de creación con LLM",
  en: "LLM creation guide",
  be: "Кіраўніцтва па стварэнні з LLM",
};

const GUIDE_CLOSE = { es: "Cerrar", en: "Close", be: "Закрыць" };

/* Abbreviated guide content — pre-rendered HTML (mockup).
   Production: built from docs/llm-rutina-prompt.{es,en,be}.md at build time. */
const GUIDE_HTML = {
  es: `
    <h2>Cómo crear tu rutina con un LLM</h2>
    <p>Sigue estos pasos para generar un <code>rutina.json</code> válido usando un asistente de IA (ChatGPT, Claude, Gemini, etc.).</p>

    <h3>Paso 1 — Rellena el checklist</h3>
    <p>Antes de hablar con el LLM, prepara esta información:</p>
    <ul>
      <li>Nivel de experiencia (principiante / intermedio / avanzado)</li>
      <li>Días disponibles por semana (p.ej. lunes, miércoles, viernes)</li>
      <li>Objetivo principal (fuerza, hipertrofia, resistencia, pérdida de grasa)</li>
      <li>Lesiones o restricciones actuales</li>
    </ul>

    <h3>Paso 2 — Adjunta tu lista de equipamiento</h3>
    <p>Copia el contenido de <code>data/equipment.json</code> en el chat. El LLM usará los <code>equipmentId</code> exactos de ese archivo para generar tu rutina.</p>

    <h3>Paso 3 — Pega la plantilla de prompt</h3>
    <pre><code>Eres un entrenador personal experto en máquinas Matrix Aura.
Genera un rutina.json válido siguiendo el esquema rutina.schema.json.
Usa solo los equipmentId del archivo adjunto.
Mi objetivo: [fuerza / hipertrofia / resistencia]
Días: [lunes, miércoles, viernes]
Nivel: [principiante / intermedio / avanzado]</code></pre>

    <h3>Paso 4 — Copia el JSON generado</h3>
    <p>El LLM devolverá un bloque JSON. Cópialo completo, incluyendo las llaves de apertura <code>{</code> y cierre <code>}</code>.</p>

    <h3>Paso 5 — Importa y valida</h3>
    <p>Pega el JSON en el campo de texto de la pantalla de importación y pulsa <strong>Importar</strong>. Si hay errores de validación, cópialos y envíaselos al LLM para que los corrija.</p>

    <h3>Solución de problemas</h3>
    <p><strong>equipmentId no encontrado:</strong> el LLM inventó un ID que no existe. Adjunta <code>data/equipment.json</code> de nuevo y pide corrección.</p>
    <p><strong>schemaVersion requerido:</strong> añade <code>"schemaVersion": 1</code> al nivel raíz del JSON.</p>
    <p><strong>phaseName requerido:</strong> añade <code>"program": { "phaseName": "Fase 1" }</code> al JSON.</p>
  `,

  en: `
    <h2>How to create your routine with an LLM</h2>
    <p>Follow these steps to generate a valid <code>rutina.json</code> file using an AI assistant (ChatGPT, Claude, Gemini, etc.).</p>

    <h3>Step 1 — Fill in the checklist</h3>
    <p>Before talking to the LLM, prepare this information:</p>
    <ul>
      <li>Experience level (beginner / intermediate / advanced)</li>
      <li>Available days per week (e.g. Monday, Wednesday, Friday)</li>
      <li>Primary goal (strength, hypertrophy, endurance, fat loss)</li>
      <li>Current injuries or restrictions</li>
    </ul>

    <h3>Step 2 — Attach your equipment list</h3>
    <p>Copy the contents of <code>data/equipment.json</code> into the chat. The LLM will use the exact <code>equipmentId</code> values from that file to generate your routine.</p>

    <h3>Step 3 — Paste the prompt template</h3>
    <pre><code>You are a personal trainer expert in Matrix Aura machines.
Generate a valid rutina.json following the rutina.schema.json schema.
Use only the equipmentId values from the attached file.
My goal: [strength / hypertrophy / endurance]
Days: [Monday, Wednesday, Friday]
Level: [beginner / intermediate / advanced]</code></pre>

    <h3>Step 4 — Copy the generated JSON</h3>
    <p>The LLM will return a JSON block. Copy it completely, including the opening <code>{</code> and closing <code>}</code> braces.</p>

    <h3>Step 5 — Import and validate</h3>
    <p>Paste the JSON into the import screen and press <strong>Import</strong>. If there are validation errors, copy them and send them back to the LLM for correction.</p>

    <h3>Troubleshooting</h3>
    <p><strong>equipmentId not found:</strong> the LLM invented an ID that does not exist. Attach <code>data/equipment.json</code> again and ask for a fix.</p>
    <p><strong>schemaVersion required:</strong> add <code>"schemaVersion": 1</code> at the root level of the JSON.</p>
    <p><strong>phaseName required:</strong> add <code>"program": { "phaseName": "Phase 1" }</code> to the JSON.</p>
  `,

  be: `
    <h2>Як стварыць сваю руціну з LLM</h2>
    <p>Выконвайце гэтыя крокі, каб стварыць сапраўдны файл <code>rutina.json</code> з дапамогай штучнага інтэлекту (ChatGPT, Claude, Gemini і інш.).</p>

    <h3>Крок 1 — Запоўніце спіс</h3>
    <p>Перад размовай з LLM падрыхтуйце наступную інфармацыю:</p>
    <ul>
      <li>Узровень вопыту (пачатковец / сярэдні / прасунуты)</li>
      <li>Даступныя дні на тыдзень (напрыклад, панядзелак, серада, пятніца)</li>
      <li>Асноўная мэта (сіла, гіпертрофія, вынослівасць, страта тлушчу)</li>
      <li>Бягучыя траўмы або абмежаванні</li>
    </ul>

    <h3>Крок 2 — Прыкладзіце спіс абсталявання</h3>
    <p>Скапіруйце змест <code>data/equipment.json</code> у чат. LLM будзе выкарыстоўваць дакладныя значэнні <code>equipmentId</code> з гэтага файла.</p>

    <h3>Крок 3 — Устаўце шаблон запыту</h3>
    <pre><code>Ты персанальны трэнер, эксперт па машынах Matrix Aura.
Стварыце сапраўдны rutina.json паводле схемы rutina.schema.json.
Выкарыстоўвайце толькі значэнні equipmentId з прыкладзенага файла.
Мая мэта: [сіла / гіпертрофія / вынослівасць]
Дні: [панядзелак, серада, пятніца]
Узровень: [пачатковец / сярэдні / прасунуты]</code></pre>

    <h3>Крок 4 — Скапіруйце JSON</h3>
    <p>LLM верне блок JSON. Скапіруйце яго цалкам, уключаючы адкрываючыя <code>{</code> і закрываючыя <code>}</code> фігурныя дужкі.</p>

    <h3>Крок 5 — Імпартуйце і праверайце</h3>
    <p>Устаўце JSON у тэкставае поле на экране імпарту і націсніце <strong>Імпартаваць</strong>. Калі ёсць памылкі праверкі, скапіруйце іх і адпраўце назад у LLM для выпраўлення.</p>

    <h3>Вырашэнне праблем</h3>
    <p><strong>equipmentId не знойдзены:</strong> LLM прыдумаў ID, якога не існуе. Прыкладзіце <code>data/equipment.json</code> зноў і папрасіце выправіць.</p>
    <p><strong>schemaVersion патрабуецца:</strong> дадайце <code>"schemaVersion": 1</code> на каранёвым узроўні JSON.</p>
    <p><strong>phaseName патрабуецца:</strong> дадайце <code>"program": { "phaseName": "Фаза 1" }</code> у JSON.</p>
  `,
};

/* Scoped styles for guide article content (pre-rendered HTML from Markdown). */
const ARTICLE_CSS = `
  .guide-article h2 { font: var(--text-h3); color: var(--bf-ink); margin: 0 0 12px; }
  .guide-article h3 { font: var(--text-h4); color: var(--bf-ink); margin: 20px 0 8px; }
  .guide-article p  { margin: 8px 0; }
  .guide-article ul { padding-left: 20px; display: grid; gap: 6px; margin: 8px 0; }
  .guide-article strong { font-weight: 700; }
  .guide-article code {
    font: 13px/1.4 monospace;
    background: var(--bf-grey-1);
    padding: 1px 5px;
    border-radius: 3px;
  }
  .guide-article pre {
    background: var(--bf-grey-1);
    border-radius: var(--radius-control);
    padding: 12px 14px;
    font: 13px/1.5 monospace;
    overflow-x: auto;
    white-space: pre-wrap;
    margin: 8px 0;
  }
  .guide-article pre code {
    background: none;
    padding: 0;
  }
`;

/* ─── Component ─────────────────────────────────────────────────────────── */

/** Mockup — GuideOverlay (state: open).
    States covered: open (default) — see ux-design.md States Matrix.
    Props:
      locale:  'es' | 'en' | 'be'   — controls title, close label, content language
      onClose: () => void            — called when × is pressed or Escape is pressed */
function GuideOverlay({ locale = "es", onClose }) {
  const title      = GUIDE_TITLE[locale] || GUIDE_TITLE.en;
  const closeLabel = GUIDE_CLOSE[locale] || "Close";
  const html       = GUIDE_HTML[locale]  || GUIDE_HTML.en;

  /* gym-directory-and-catalog (2026-08-09) — Club Picker trigger, replacing
     the old "no sabes el id de tu gimnasio? -> gyms.html" link (S5/S6,
     ux-design.md Screens A/A'). Selection persists via BF_KIT_CLUB_STORE so
     it's shared with CatalogScreen's club filter (same picker, shared
     singleton — see ux-design.md's Interaction summary). */
  const [club, setClub] = React.useState(() => window.BF_KIT_CLUB_STORE.get());
  const [showPicker, setShowPicker] = React.useState(false);
  const [showOverlay, setShowOverlay] = React.useState(false);
  const ClubPickerSheetComp = window.ClubPickerSheet;
  const EquipmentOverlaySheetComp = window.EquipmentOverlaySheet;

  function handleSelectClub(c) {
    setClub(c);
    window.BF_KIT_CLUB_STORE.set(c);
    setShowPicker(false);
  }

  /* Escape key closes the overlay (standard dialog behaviour — AC2). */
  React.useEffect(() => {
    function handleKey(e) {
      if (e.key === "Escape" && onClose) onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <>
      <style>{ARTICLE_CSS}</style>

      {/* ── Overlay container ──────────────────────────────────────────── */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="guide-overlay-title"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 400,                   /* above ConfirmSheet (300) */
          background: "var(--bf-white)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* ── Sticky header ────────────────────────────────────────────── */}
        <div style={{
          flexShrink: 0,
          background: "var(--bf-white)",
          borderBottom: "1px solid var(--bf-grey-2)",
          padding: "var(--space-4) var(--page-gutter)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <span
            id="guide-overlay-title"
            style={{ font: "var(--text-h4)", color: "var(--bf-ink)" }}
          >
            {title}
          </span>

          <button
            type="button"
            aria-label={closeLabel}
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text-muted)",
              background: "none",
              border: "none",
              borderRadius: "var(--radius-control)",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <GuideIcon name="x" size={20} />
          </button>
        </div>

        {/* ── Scrollable content ───────────────────────────────────────── */}
        <div style={{
          flex: 1,
          overflowY: "auto",
          padding: "var(--space-6) var(--page-gutter) var(--space-10)",
        }}>
          {/* ── Club Picker trigger (ux-design.md Screens A/A') ──────────── */}
          <div style={{
            maxWidth: 600, margin: "0 0 var(--space-6)",
            background: "var(--bf-purple-tint)", border: "1px solid var(--bf-purple)",
            borderRadius: "var(--radius-md)", padding: "12px 14px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <GuideIcon name="map-pin" size={18} style={{ color: "var(--bf-purple)" }} />
              <span style={{ font: "700 13px/1.3 var(--font-sans)", color: "var(--bf-ink)" }}>Tu club</span>
            </div>
            <button
              type="button"
              onClick={() => setShowPicker(true)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
                width: "100%", textAlign: "left", cursor: "pointer",
                background: "var(--bf-white)", border: "1px solid var(--border-control)",
                borderRadius: "var(--radius-control)", padding: "11px 14px",
              }}
            >
              {club ? (
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", font: "700 14px/1.3 var(--font-sans)", color: "var(--bf-ink)" }}>{club.name}</span>
                  <span style={{ display: "block", font: "var(--text-caption)", color: "var(--bf-ink-2)" }}>{club.address} · {club.cityName}</span>
                </span>
              ) : (
                <span style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-muted)" }}>
                  <GuideIcon name="search" size={16} />
                  Selecciona tu club
                </span>
              )}
              <GuideIcon name="chevron-right" size={18} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
            </button>
            {club && (
              <a
                href="#"
                onClick={(e) => { e.preventDefault(); setShowOverlay(true); }}
                style={{ display: "inline-block", marginTop: 8, font: "600 13px/1.2 var(--font-sans)", color: "var(--text-link)" }}
              >
                ¿Equipamiento distinto en tu club? →
              </a>
            )}
          </div>

          <article
            className="guide-article"
            style={{
              font: "var(--text-body-sm)",
              color: "var(--bf-ink)",
              lineHeight: 1.6,
              maxWidth: 600,
            }}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      </div>

      {showPicker && ClubPickerSheetComp && (
        <ClubPickerSheetComp
          initialClub={club}
          onSelect={handleSelectClub}
          onManualEdit={() => setShowPicker(false)}
          onClose={() => setShowPicker(false)}
        />
      )}
      {showOverlay && club && EquipmentOverlaySheetComp && (
        <EquipmentOverlaySheetComp
          clubName={club.name}
          clubId={club.id}
          onClose={() => setShowOverlay(false)}
        />
      )}
    </>
  );
}

window.GuideOverlay = GuideOverlay;
