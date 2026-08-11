const DS2 = window.BasicFitDesignSystem_1cb8a2;
const { PageHeader: CatHeader, FilterPill, EquipmentCard, StatCard, PageFooter: CatFooter } = DS2;

/**
 * gym-directory-and-catalog (2026-08-09) additions (ux-design.md §4 /
 * mockups.md Screens G/G′/G″): a Club filter row replacing the removed
 * per-gym "Gimnasios" card section (X8/AC45 — 1,726 clubs is not a page),
 * and OQ-D resolved — "Solo mi club" defaults ON the moment a club exists,
 * and doesn't render at all before that (see ux-design.md §4 for the full
 * reasoning). Shares ClubPickerSheet/EquipmentOverlaySheet + the
 * BF_KIT_CLUB_STORE persistence with GuideOverlay — same shared singletons,
 * not per-screen duplicates.
 */
function CatalogScreen() {
  const data = window.BF_KIT_DATA;
  const dir = window.BF_KIT_DIRECTORY;
  const store = window.BF_KIT_CLUB_STORE;
  const [lang, setLang] = React.useState("es");
  const [cat, setCat] = React.useState("all");
  const [club, setClub] = React.useState(() => store.get());
  // OQ-D: defaults ON the moment a club exists; irrelevant/hidden until then.
  const [clubFilterOn, setClubFilterOn] = React.useState(() => !!store.get());
  const [showPicker, setShowPicker] = React.useState(false);
  const [showOverlay, setShowOverlay] = React.useState(false);
  const [excludedVersion, setExcludedVersion] = React.useState(0);
  const ClubPickerSheetComp = window.ClubPickerSheet;
  const EquipmentOverlaySheetComp = window.EquipmentOverlaySheet;

  const excluded = React.useMemo(
    () => new Set(club ? store.getExcluded(club.id) : []),
    [club, excludedVersion] // eslint-disable-line react-hooks/exhaustive-deps
  );

  function handleSelectClub(c) {
    setClub(c);
    store.set(c);
    setClubFilterOn(true); // OQ-D — a fresh selection defaults the filter on
    setShowPicker(false);
  }

  const items = data.equipment.filter((e) => {
    if (cat !== "all" && e.cat !== cat) return false;
    if (club && clubFilterOn && excluded.has(e.id)) return false;
    return true;
  });
  const wrap = { maxWidth: 900, margin: "0 auto", padding: "0 var(--page-gutter)" };
  return (
    <div data-screen-label="Catálogo de equipamiento" style={{ background: "var(--bf-grey-1)", minHeight: "100%" }}>
      <CatHeader
        breadcrumb={[{ label: "Home", href: "#" }, { label: "Equipamiento" }]}
        title="Catálogo de equipamiento"
        subtitle="Máquinas Matrix Aura + ZIVA en tus gimnasios Basic-Fit"
      />
      <div style={{ ...wrap, marginTop: "var(--space-6)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          <StatCard value={String(data.equipment.length)} label="máquinas" />
          <StatCard value={dir.totalClubs.toLocaleString("es-ES")} label="clubes" />
          <StatCard value="3" label="idiomas" />
        </div>
      </div>
      <div style={{ ...wrap, marginTop: "var(--space-6)", display: "grid", gap: 12 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ font: "var(--text-label)", letterSpacing: "var(--tracking-label)", textTransform: "uppercase", color: "var(--text-muted)" }}>Idioma</span>
          {["en", "es", "be"].map((l) => (
            <FilterPill key={l} active={lang === l} onClick={() => setLang(l)}>{l.toUpperCase()}</FilterPill>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ font: "var(--text-label)", letterSpacing: "var(--tracking-label)", textTransform: "uppercase", color: "var(--text-muted)" }}>Categoría</span>
          {data.cats.map((c) => (
            <FilterPill key={c.id} active={cat === c.id} onClick={() => setCat(c.id)}>{c.es}</FilterPill>
          ))}
        </div>
        {/* Club row — its own row, never appended to Categoría's 8-pill row (AC20 narrow-gutter protection). */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ font: "var(--text-label)", letterSpacing: "var(--tracking-label)", textTransform: "uppercase", color: "var(--text-muted)" }}>Club</span>
          {club ? (
            <>
              <FilterPill active={clubFilterOn} onClick={() => setClubFilterOn((v) => !v)}>Solo mi club</FilterPill>
              <a href="#" onClick={(e) => { e.preventDefault(); setShowOverlay(true); }} style={{ font: "600 13px/1.2 var(--font-sans)", color: "var(--text-link)" }}>
                Editar equipamiento →
              </a>
              <a href="#" onClick={(e) => { e.preventDefault(); setShowPicker(true); }} style={{ font: "var(--text-caption)", color: "var(--text-muted)" }}>
                (cambiar club)
              </a>
            </>
          ) : (
            <a href="#" onClick={(e) => { e.preventDefault(); setShowPicker(true); }} style={{ font: "var(--text-body-sm)", color: "var(--text-link)" }}>
              Selecciona tu club para filtrar por equipamiento real →
            </a>
          )}
        </div>
      </div>
      <div style={{
        ...wrap, marginTop: "var(--space-5)", paddingBottom: "var(--space-10)",
        display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14, alignItems: "start",
      }}>
        {items.map((e) => (
          <EquipmentCard key={e.id}
            name={e.name[lang]} modelCode={e.model} series="Aura"
            imageUrl={e.img}
            primaryMuscles={e.prim} secondaryMuscles={e.sec}
            description={e.desc[lang]}
            weight={e.weight}
            videoHref="#" manualHref={"https://jhtsupport.com/eng/matrix/manuals/" + e.id}
          />
        ))}
        {items.length === 0 && (
          <div style={{ gridColumn: "1 / -1", background: "#fff", borderRadius: 12, padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
            Sin resultados
          </div>
        )}
      </div>
      <CatFooter lines={["Datos: Matrix Fitness + ZIVA + Basic-Fit", data.equipment.length + " máquinas · " + dir.totalClubs.toLocaleString("es-ES") + " clubes · EN/ES/BE"]} />

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
          onClose={() => { setShowOverlay(false); setExcludedVersion((v) => v + 1); }}
        />
      )}
    </div>
  );
}

window.CatalogScreen = CatalogScreen;
