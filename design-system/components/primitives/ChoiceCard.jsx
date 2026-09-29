import React from "react";

/**
 * Whole-card choice: ONE <button> containing badge, title, body, meta and a
 * CTA-looking label (a span — never a nested button). The accessible name is
 * badge + title + CTA label, so a screen reader hears the recommendation once.
 * `recommended` = 2px purple border + tint + badge + primary CTA look;
 * default = 1px control border + outline CTA look.
 */
export function ChoiceCard({ recommended = false, title, body, meta, ctaLabel, onSelect, badge, style }) {
  const cta = recommended
    ? { background: "var(--bf-purple)", color: "var(--bf-white)", border: "2px solid var(--bf-purple)" }
    : { background: "var(--bf-white)", color: "var(--bf-purple)", border: "2px solid var(--bf-purple)" };
  return (
    <button
      type="button"
      onClick={onSelect}
      data-variant={recommended ? "recommended" : "default"}
      style={{
        display: "flex", flexDirection: "column", alignItems: "stretch", gap: 8, width: "100%",
        textAlign: "left", boxSizing: "border-box", padding: "16px 18px", cursor: "pointer",
        color: "var(--bf-ink)", font: "var(--text-body-sm)",
        borderRadius: "var(--radius-md)",
        border: recommended ? "2px solid var(--bf-purple)" : "1px solid var(--border-control)",
        background: recommended ? "var(--bf-purple-tint)" : "var(--bf-white)",
        ...style,
      }}
    >
      {recommended && badge ? (
        <span style={{
          alignSelf: "flex-start", padding: "3px 10px", borderRadius: "var(--radius-sm)",
          background: "var(--bf-purple)", color: "var(--bf-white)",
          font: "700 11px/1.2 var(--font-sans)", letterSpacing: "0.06em", textTransform: "uppercase",
        }}>
          {badge}
        </span>
      ) : null}
      <span style={{ font: "var(--text-h4)", color: "var(--bf-ink)" }}>{title}</span>
      <span style={{ color: "var(--bf-ink-2)" }}>{body}</span>
      {meta ? <span style={{ font: "var(--text-caption)", color: "var(--text-muted)" }}>{meta}</span> : null}
      <span style={{
        display: "flex", alignItems: "center", justifyContent: "center", minHeight: 48, marginTop: 4,
        boxSizing: "border-box", padding: "0 24px", borderRadius: "var(--radius-btn)",
        font: "700 15px/1 var(--font-sans)", letterSpacing: "0.04em", textTransform: "uppercase",
        ...cta,
      }}>
        {ctaLabel}
      </span>
    </button>
  );
}
