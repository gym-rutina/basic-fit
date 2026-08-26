import React from "react";
import { Tag } from "../primitives/Tag.jsx";
import { Badge } from "../primitives/Badge.jsx";
import { Button } from "../primitives/Button.jsx";

/** Tag's "secondary" visual tokens, reused by the MoreMusclesChip toggle so
 * the collapsed «+N» control reads as part of the tag row it expands
 * (pill-overflow-ux D-E). Kept next to the card — NOT promoted to a DS
 * primitive (single consumer, user-ratified OQ4). */
const CHIP_TOKENS = {
  display: "inline-flex",
  alignItems: "center",
  padding: "4px 10px",
  font: "700 12px/1.3 var(--font-sans)",
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  borderRadius: "var(--radius-sm)",
  whiteSpace: "nowrap",
  background: "var(--bf-grey-1)",
  color: "var(--bf-ink-2)",
  border: "1px solid var(--bf-grey-3)",
  cursor: "pointer",
};

/**
 * Toggle control for the card's secondary muscle tags: collapsed it shows
 * «+N»; expanded it shows the collapse affordance. Because the design system
 * is i18n-free by architecture, the accessible names arrive as PROPS from the
 * caller (secondaryMoreLabel / secondaryLessLabel); when absent the component
 * degrades to its bare «+N» so it stays usable standalone.
 *
 * The action label rides on aria-label, which REPLACES the visible «+N» as
 * the accessible name (AC19 — the name states what the control DOES, never
 * just "+2") without duplicating it visually.
 */
function MoreMusclesChip({ count, expanded, onToggle, moreLabel, lessLabel }) {
  const text = expanded ? lessLabel || `+${count}` : `+${count}`;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      aria-label={expanded ? (lessLabel || undefined) : (moreLabel || undefined)}
      style={CHIP_TOKENS}
    >
      {text}
    </button>
  );
}

/**
 * Catalog card for one machine: photo, name, model, muscles, description, links.
 *
 * pill-overflow-ux S5 (AC16–AC19): primary muscles render as today; secondary
 * muscles collapse into one interactive «+N» chip that expands in place,
 * per-card (mirrors the hover useState pattern below — expansion of one card
 * must not move another).
 */
export function EquipmentCard({
  name,
  modelCode,
  series,
  imageUrl,
  primaryMuscles = [],
  secondaryMuscles = [],
  description,
  weight,
  videoHref,
  manualHref,
  secondaryMoreLabel,
  secondaryLessLabel,
  style,
}) {
  const [hover, setHover] = React.useState(false);
  const [secondariesExpanded, setSecondariesExpanded] = React.useState(false);
  return (
    <article onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} style={{
      background: "var(--surface-card)", border: "1px solid var(--border-default)",
      borderRadius: "var(--radius-lg)", overflow: "hidden",
      boxShadow: hover ? "var(--shadow-raised)" : "var(--shadow-card)",
      transform: hover ? "translateY(-2px)" : "none",
      transition: "box-shadow var(--motion-base), transform var(--motion-base)", ...style,
    }}>
      <div style={{
        height: 190, background: "var(--bf-grey-1)", display: "flex",
        alignItems: "center", justifyContent: "center", position: "relative",
      }}>
        {imageUrl
          ? <img src={imageUrl} alt={typeof name === "string" ? name : "máquina"} style={{ maxWidth: "88%", maxHeight: "88%", objectFit: "contain" }} />
          : <span style={{ font: "var(--text-caption)", color: "var(--bf-grey-4)" }}>Sin imagen</span>}
        {weight != null && (
          <Badge tone="brand" style={{ position: "absolute", top: 12, right: 12 }}>{weight} kg</Badge>
        )}
      </div>
      <div style={{ padding: "var(--space-4)" }}>
        <h3 style={{ font: "var(--text-h3)", margin: 0 }}>{name}</h3>
        <div style={{ font: "var(--text-caption)", color: "var(--text-muted)", margin: "4px 0 10px" }}>
          {/* gym-directory-and-catalog X4 — equipment.json is Matrix machines
              PLUS ZIVA free weights/benches/accessories, so hardcoding the
              "Matrix" vendor word here would mislabel every ZIVA card. The
              series name (shipped, vendor-agnostic) is still shown; modelCode
              already carries the vendor signal via its own prefix
              (G3-/MG-/ZVO-/ZMT-/...). */}
          {series ? `${series} · ` : ""}{modelCode}
        </div>
        {(primaryMuscles.length > 0 || secondaryMuscles.length > 0) && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10, position: "relative" }}>
            {primaryMuscles.map((m, i) => <Tag key={"p" + i} tone="primary">{m}</Tag>)}
            {secondaryMuscles.length > 0 &&
              (secondariesExpanded ? (
                <>
                  {secondaryMuscles.map((m, i) => <Tag key={"s" + i} tone="secondary">{m}</Tag>)}
                  <MoreMusclesChip
                    count={secondaryMuscles.length}
                    expanded
                    onToggle={() => setSecondariesExpanded(false)}
                    moreLabel={secondaryMoreLabel}
                    lessLabel={secondaryLessLabel}
                  />
                </>
              ) : (
                <MoreMusclesChip
                  count={secondaryMuscles.length}
                  expanded={false}
                  onToggle={() => setSecondariesExpanded(true)}
                  moreLabel={secondaryMoreLabel}
                  lessLabel={secondaryLessLabel}
                />
              ))}
          </div>
        )}
        {description && <p style={{ font: "var(--text-body-sm)", color: "var(--text-body)", margin: "0 0 12px" }}>{description}</p>}
        {(videoHref || manualHref) && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {videoHref && <Button variant="primary" size="sm" href={videoHref}>ver tutorial</Button>}
            {manualHref && <Button variant="secondary" size="sm" href={manualHref}>manual</Button>}
          </div>
        )}
      </div>
    </article>
  );
}
