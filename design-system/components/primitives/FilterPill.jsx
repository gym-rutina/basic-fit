import React from "react";

/**
 * Toggleable filter chip (site style): white with 1px ink border; active =
 * solid orange. `...rest` passthrough (pwa-ui-language tech-plan.md D18) lets
 * SettingsScreen's language picker carry `role="radio"`/`aria-checked` etc.
 * without a second control — CatalogScreen's own `Idioma` row (AC14) is
 * deliberately left without those attributes, so it renders exactly as
 * before.
 */
export function FilterPill({ active = false, onClick, children, style, ...rest }) {
  const [hover, setHover] = React.useState(false);
  const s = {
    padding: "11px 22px", font: "600 15px/1.2 var(--font-sans)",
    borderRadius: "var(--radius-control)", cursor: "pointer",
    border: "1px solid " + (active ? "var(--bf-orange)" : "var(--border-control)"),
    background: active ? "var(--bf-orange)" : "var(--bf-white)",
    color: active ? "var(--bf-white)" : "var(--bf-ink)",
    boxShadow: hover && !active ? "inset 0 0 0 1px var(--border-control)" : "none",
    transition: "all var(--motion-fast)", whiteSpace: "nowrap",
    ...style,
  };
  return (
    <button style={s} onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} {...rest}>
      {children}
    </button>
  );
}
