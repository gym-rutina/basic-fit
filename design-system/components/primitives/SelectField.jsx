import React from "react";
import { Icon } from "./Icon.jsx";

/**
 * pill-overflow-ux OQ1/OQ2 (tech-plan.md D-B) — the design system's FIRST
 * form primitive: a thin wrapper around the native <select>. NO listbox/
 * combobox machinery — a custom accessible combobox is the highest-bug-density
 * widget in frontend and this codebase has zero listbox infrastructure to
 * build on (ux-design §0). The native control gives keyboard/screenreader/
 * mobile-picker behaviour free; its open-state visuals are OS-owned by design.
 *
 * Props:
 *   id        — wires the visible label to the select (`htmlFor`/`id`) and
 *               namespaces the hint (`${id}-hint`); must be unique per page.
 *   label     — visible micro-label text (the select's accessible name).
 *   value     — currently selected option value.
 *   options   — [{ value: string, label: string }]; rendered in array order,
 *               count-agnostic (AC9 — no hardcoded language-count assumption).
 *   onChange  — called with the selected VALUE STRING, never the event
 *               (callers never need the event; keeps call sites terse).
 *   hint?     — optional helper line wired via aria-describedby.
 *
 * Registration scope: this feature's consumers all live in the React app,
 * which imports primitives as ES modules directly (FilterPill precedent).
 * _ds_bundle.js is deliberately NOT regenerated here (known module-order bug;
 * no generator script exists) — tech-plan.md D-B.
 */
export function SelectField({ id, label, value, options = [], onChange, hint }) {
  const [focus, setFocus] = React.useState(false);
  const wrapStyle = {
    position: "relative",
    display: "flex",
    alignItems: "center",
    maxWidth: "100%",
    marginTop: 10,
  };
  const selectStyle = {
    appearance: "none",
    WebkitAppearance: "none",
    MozAppearance: "none",
    width: "100%",
    minHeight: 44,
    padding: "10px 40px 10px 14px",
    font: "400 15px/1.3 var(--font-sans)",
    color: "var(--bf-ink)",
    background: "var(--bf-white)",
    border: "1px solid " + (focus ? "var(--bf-purple)" : "var(--border-control)"),
    borderRadius: "var(--radius-control)",
    cursor: "pointer",
    outline: focus ? "2px solid var(--bf-purple-tint)" : "none",
    outlineOffset: focus ? 1 : 0,
  };
  return (
    <>
      <label
        htmlFor={id}
        style={{
          display: "block",
          font: "var(--text-label)",
          letterSpacing: "var(--tracking-label)",
          textTransform: "uppercase",
          color: "var(--text-muted)",
        }}
      >
        {label}
      </label>
      <div style={wrapStyle}>
        <select
          id={id}
          value={value}
          onChange={(e) => onChange && onChange(e.target.value)}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          aria-describedby={hint ? `${id}-hint` : undefined}
          style={selectStyle}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {/* Decorative affordance only — Icon renders aria-hidden="true" and
            the native select owns the semantics. */}
        <Icon
          name="chevron-down"
          size={18}
          style={{ position: "absolute", right: 12, pointerEvents: "none", color: "var(--text-muted)" }}
        />
      </div>
      {hint && (
        <p
          id={`${id}-hint`}
          style={{ font: "var(--text-caption)", color: "var(--text-muted)", margin: "6px 0 0" }}
        >
          {hint}
        </p>
      )}
    </>
  );
}
