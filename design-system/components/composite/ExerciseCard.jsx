import React from "react";
import { Tag } from "../primitives/Tag.jsx";
import { DetailItem } from "../primitives/DetailItem.jsx";

/**
 * Full exercise card for routine day sections. Mobile-first; details grid wraps.
 *
 * `equipmentLabel`/`alternativeLabel`/`techniqueLabel` — pwa-ui-language AC16
 * code-QA follow-up (Cmok fix cycle 1). `ExerciseCard` has two consumers with
 * OPPOSITE language requirements: the PWA (`app/src/screens/ProgramScreen.jsx`,
 * must localize) and the static-HTML deliverables (DD-1, deliberately kept
 * Spanish). Optional props with the shipped Spanish text as defaults, same
 * pattern as `videoLabel`, preserve the static side byte-for-byte while
 * letting the PWA pass translated labels via `t()`.
 */
export function ExerciseCard({ number, name, muscles = [], details = [], equipment, alternative, imageUrl, steps = [], videoHref, videoLabel = "Ver tutorial en YouTube →", equipmentLabel = "Equipo:", alternativeLabel = "Alternativa:", techniqueLabel = "Técnica", style }) {
  const [hover, setHover] = React.useState(false);
  return (
    <article onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} style={{
      background: "var(--surface-card)", border: "1px solid var(--border-default)",
      borderRadius: "var(--radius-lg)", padding: "var(--space-5)",
      boxShadow: hover ? "var(--shadow-raised)" : "var(--shadow-card)",
      transition: "box-shadow var(--motion-base)", ...style,
    }}>
      <header style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <span style={{
          width: 36, height: 36, flexShrink: 0, borderRadius: "50%",
          background: "var(--bf-orange)", color: "var(--bf-white)",
          display: "flex", alignItems: "center", justifyContent: "center",
          font: "800 16px/1 var(--font-display)",
        }}>{number}</span>
        <div style={{ minWidth: 0 }}>
          {/* pwa-ui-language AC16 (tech-plan.md D14/D19): the exercise NAME is
              axis-3 (user-authored) content — the app does not know its
              language, so it gets dir="auto" and no lang attribute. */}
          <h3 dir="auto" style={{ font: "var(--text-h3)", margin: 0 }}>{name}</h3>
          {muscles.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              {muscles.map((m, i) => <Tag key={i} tone={i === 0 ? "primary" : "secondary"}>{m}</Tag>)}
            </div>
          )}
        </div>
      </header>

      {details.length > 0 && (
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: "var(--space-2)", margin: "var(--space-4) 0 0",
        }}>
          {details.map((d, i) => <DetailItem key={i} label={d.label} value={d.value} />)}
        </div>
      )}

      {(equipment || alternative) && (
        <div style={{ marginTop: "var(--space-4)", font: "var(--text-body-sm)", color: "var(--text-body)", display: "grid", gap: 4 }}>
          {equipment && <div><strong style={{ color: "var(--text-heading)" }}>{equipmentLabel}</strong> {equipment}</div>}
          {alternative && <div style={{ color: "var(--text-muted)" }}><em>{alternativeLabel}</em> {alternative}</div>}
        </div>
      )}

      {imageUrl && (
        <div style={{ textAlign: "center", marginTop: "var(--space-4)" }}>
          <img src={imageUrl} alt={typeof name === "string" ? name : "equipo"} style={{
            maxWidth: "100%", maxHeight: 240, borderRadius: "var(--radius-md)",
            background: "var(--bf-grey-1)",
          }} />
        </div>
      )}

      {steps.length > 0 && (
        <div style={{
          marginTop: "var(--space-4)", background: "var(--bf-grey-1)",
          borderRadius: "var(--radius-md)", padding: "var(--space-4)",
        }}>
          <div style={{
            font: "var(--text-label)", letterSpacing: "var(--tracking-label)",
            textTransform: "uppercase", color: "var(--bf-orange-deep)", marginBottom: 8,
          }}>{techniqueLabel}</div>
          <ol style={{ margin: 0, paddingLeft: 20, font: "var(--text-body-sm)", color: "var(--text-body)", display: "grid", gap: 4 }}>
            {/* Technique cues are axis-3 too — same dir="auto", no lang. */}
            {steps.map((s, i) => <li key={i} dir="auto">{s}</li>)}
          </ol>
        </div>
      )}

      {videoHref && (
        <a href={videoHref} target="_blank" rel="noopener noreferrer" style={{
          display: "inline-block", marginTop: "var(--space-3)",
          font: "600 14px/1.3 var(--font-sans)", color: "var(--text-link)",
        }}>
          {videoLabel}
          <span className="sr-only"> (se abre en una pestaña nueva)</span>
        </a>
      )}
    </article>
  );
}
