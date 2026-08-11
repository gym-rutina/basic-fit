const DSOverlay = window.BasicFitDesignSystem_1cb8a2;
const { Icon: OverlayIcon, Button: OverlayButton } = DSOverlay;

/**
 * Mockup — EquipmentOverlaySheet (gym-directory-and-catalog, ux-design.md §3 /
 * mockups.md Screens E/F/F′/F‴). Lists all catalog entries in 3 STATIC sections
 * by `kind` (Máquinas / Peso libre / Accesorios) — deliberately not Accordion.jsx
 * (single-open, no aria-expanded) and not CheckList.jsx (read-only, no real
 * input) — see ux-design.md §3 for why both were rejected.
 *
 * Shared singleton: opened from both GuideOverlay (post club-selection) and
 * CatalogScreen — same component, same club-scoped exclusion list, persisted
 * via BF_KIT_CLUB_STORE so both entry points agree (ux-design.md Interaction
 * summary: "shared singletons, not per-screen duplicates").
 *
 * Props:
 *   clubName: string — header subtitle.
 *   clubId: string — scopes the persisted exclusion list.
 *   simulateWriteError: bool — demos Screen F‴ (IndexedDB write failure,
 *     R7.3: must never block completion).
 *   onClose(): called on ✕ / scrim / Escape / "Listo".
 */
function EquipmentOverlaySheet({ clubName, clubId, simulateWriteError = false, onClose }) {
  const data = window.BF_KIT_DATA;
  const store = window.BF_KIT_CLUB_STORE;
  const [excluded, setExcluded] = React.useState(() => new Set(store.getExcluded(clubId)));
  const closeRef = React.useRef(null);

  React.useEffect(() => {
    closeRef.current && closeRef.current.focus();
    function handleKey(e) {
      if (e.key === "Escape") onClose && onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  function toggle(id) {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      if (!simulateWriteError) store.setExcluded(clubId, Array.from(next));
      return next;
    });
  }

  const sections = data.kinds.map((k) => ({
    ...k,
    items: data.equipment.filter((e) => e.kind === k.id),
  }));

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(45,45,45,.5)", zIndex: 300, display: "flex", alignItems: "flex-end" }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="equipment-overlay-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--bf-white)", width: "100%", maxHeight: "85vh",
          display: "flex", flexDirection: "column",
          borderRadius: "var(--radius-lg) var(--radius-lg) 0 0",
        }}
      >
        <div style={{ flexShrink: 0, padding: "var(--space-6) var(--page-gutter) var(--space-4)", borderBottom: "1px solid var(--bf-grey-2)" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <h3 id="equipment-overlay-title" style={{ font: "var(--text-h3)", color: "var(--bf-ink)", margin: 0 }}>
                Equipamiento de tu club
              </h3>
              <p style={{ font: "var(--text-body-sm)", color: "var(--text-muted)", margin: "4px 0 0" }}>{clubName}</p>
            </div>
            <button
              ref={closeRef}
              type="button"
              aria-label="Cerrar"
              onClick={onClose}
              style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", borderRadius: "var(--radius-control)", cursor: "pointer", color: "var(--text-muted)", flexShrink: 0 }}
            >
              <OverlayIcon name="x" size={20} />
            </button>
          </div>
          <p style={{ font: "var(--text-body-sm)", color: "var(--bf-ink-2)", margin: "10px 0 0" }}>
            Desmarca lo que no tenga tu club.
          </p>
          <p style={{ font: "700 13px/1.3 var(--font-sans)", color: "var(--bf-ink)", margin: "4px 0 0" }} aria-live="polite">
            {excluded.size} excluido{excluded.size === 1 ? "" : "s"}
          </p>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "var(--space-4) var(--page-gutter)" }}>
          {sections.map((s) => (
            <div key={s.id} style={{ marginBottom: "var(--space-5)" }}>
              <div style={{ font: "var(--text-label)", letterSpacing: "var(--tracking-label)", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 }}>
                {s.es} ({s.items.length})
              </div>
              <div style={{ display: "grid", gap: 2 }}>
                {s.items.map((item) => {
                  const isExcluded = excluded.has(item.id);
                  return (
                    <label
                      key={item.id}
                      style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 44, padding: "6px 4px", cursor: "pointer" }}
                    >
                      <input
                        type="checkbox"
                        checked={!isExcluded}
                        onChange={() => toggle(item.id)}
                        style={{ width: 20, height: 20, accentColor: "var(--bf-purple)", flexShrink: 0 }}
                      />
                      <span style={{ font: "500 14px/1.3 var(--font-sans)", color: isExcluded ? "var(--text-muted)" : "var(--bf-ink)", flex: 1 }}>
                        {item.name.es}
                      </span>
                      <span style={{ font: "12px/1 monospace", color: "var(--text-muted)" }}>{item.model}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div style={{ flexShrink: 0, padding: "var(--space-4) var(--page-gutter) calc(var(--space-4) + env(safe-area-inset-bottom, 0px))", borderTop: "1px solid var(--bf-grey-2)" }}>
          {simulateWriteError && (
            <div role="alert" style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--bf-danger-tint)", border: "1px solid var(--bf-danger)", borderRadius: "var(--radius-md)", padding: "8px 12px", font: "var(--text-body-sm)", color: "var(--bf-danger)", marginBottom: 10 }}>
              <OverlayIcon name="alert-triangle" size={16} style={{ flexShrink: 0 }} />
              No se pudo guardar — los cambios se mantienen en esta sesión
            </div>
          )}
          <OverlayButton variant="primary" style={{ width: "100%" }} onClick={onClose}>
            {excluded.size > 0 ? "Listo (" + excluded.size + " excluido" + (excluded.size === 1 ? "" : "s") + ")" : "Listo"}
          </OverlayButton>
        </div>
      </div>
    </div>
  );
}

window.EquipmentOverlaySheet = EquipmentOverlaySheet;
