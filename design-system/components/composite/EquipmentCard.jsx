import React from "react";
import { Tag } from "../primitives/Tag.jsx";
import { Badge } from "../primitives/Badge.jsx";
import { Button } from "../primitives/Button.jsx";

/** Catalog card for one machine: photo, name, model, muscles, description, links. */
export function EquipmentCard({ name, modelCode, series, imageUrl, primaryMuscles = [], secondaryMuscles = [], description, weight, videoHref, manualHref, style }) {
  const [hover, setHover] = React.useState(false);
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
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
            {primaryMuscles.map((m, i) => <Tag key={"p" + i} tone="primary">{m}</Tag>)}
            {secondaryMuscles.map((m, i) => <Tag key={"s" + i} tone="secondary">{m}</Tag>)}
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
