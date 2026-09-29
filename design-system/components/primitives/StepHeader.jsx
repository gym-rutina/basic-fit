import React from "react";

/**
 * Wizard step header: "‹ Atrás" back button, "Paso N de T" (polite live
 * region) and a segmented progress bar (decorative — the text is the
 * announcement). The first `step` segments are filled.
 */
export function StepHeader({ step, total, onBack, backLabel = "Atrás", stepLabel, style }) {
  const segments = Array.from({ length: total }, (_, i) => i < step);
  return (
    <div style={{ width: "100%", ...style }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <button
          type="button"
          onClick={onBack}
          style={{
            display: "inline-flex", alignItems: "center", gap: 4, minHeight: 44, padding: "0 8px 0 0",
            font: "600 15px/1 var(--font-sans)", color: "var(--bf-purple)",
            background: "none", border: "none", cursor: "pointer",
          }}
        >
          <span aria-hidden="true">‹</span>
          {backLabel}
        </button>
        <span aria-live="polite" style={{ font: "var(--text-caption)", color: "var(--text-muted)" }}>
          {stepLabel || `Paso ${step} de ${total}`}
        </span>
      </div>
      <div data-testid="step-bar" aria-hidden="true" style={{ display: "flex", gap: 6, marginTop: 4 }}>
        {segments.map((filled, i) => (
          <span
            key={i}
            data-filled={filled ? "true" : "false"}
            style={{
              flex: 1, height: 4, borderRadius: 2,
              background: filled ? "var(--bf-purple)" : "var(--bf-grey-2)",
            }}
          />
        ))}
      </div>
    </div>
  );
}
