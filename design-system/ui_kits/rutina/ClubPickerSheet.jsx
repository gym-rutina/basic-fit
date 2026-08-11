const DSPicker = window.BasicFitDesignSystem_1cb8a2;
const { Icon: PickerIcon } = DSPicker;

/**
 * Mockup — ClubPickerSheet (gym-directory-and-catalog, ux-design.md §2 / mockups.md
 * Screens B/B′/B″/C/D). Bottom sheet, 3 stacked dependent comboboxes: País → Ciudad →
 * Club, later fields disabled until their dependency is chosen. Deliberately NOT a
 * step wizard (ux-design.md rejected OnboardingOverlay's stepper idiom — see that
 * file's §2 "Why a sheet, not a wizard").
 *
 * Reuses ConfirmSheet's positioning/scrim/dialog-a11y pattern (mem_d2f78cc1: bottom
 * sheet for unboundedly-growing option sets, not a wizard).
 *
 * Props:
 *   initialClub: { id, name, address, cityKey, cityName, countryCode, countryName } | null
 *     — when present, opens already-resolved with a breadcrumb (Screen D / retry).
 *   onSelect(club): called with the same shape as initialClub once a club is chosen.
 *   onManualEdit(): called when the user picks the zero-match escape hatch (Screen C).
 *   onClose(): called on ✕ / scrim / Escape with nothing selected.
 */
function ClubPickerSheet({ initialClub, onSelect, onManualEdit, onClose }) {
  const dir = window.BF_KIT_DIRECTORY;
  const sheetRef = React.useRef(null);
  const firstFocusRef = React.useRef(null);
  const previouslyFocusedRef = React.useRef(null);

  const [country, setCountry] = React.useState(initialClub ? initialClub.countryCode : null);
  const [city, setCity] = React.useState(initialClub ? initialClub.cityKey : null);
  const [club, setClub] = React.useState(initialClub || null);
  const [cityQuery, setCityQuery] = React.useState("");
  const [clubQuery, setClubQuery] = React.useState("");

  React.useEffect(() => {
    previouslyFocusedRef.current = document.activeElement;
    firstFocusRef.current && firstFocusRef.current.focus();
    return () => {
      const toRestore = previouslyFocusedRef.current;
      if (toRestore && typeof toRestore.focus === "function") toRestore.focus();
    };
  }, []);

  React.useEffect(() => {
    function handleKey(e) {
      if (e.key === "Escape") onClose && onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  function pickCountry(code) {
    setCountry(code);
    setCity(null);
    setClub(null);
    setCityQuery("");
    setClubQuery("");
  }

  function pickCity(key) {
    setCity(key);
    setClub(null);
    setClubQuery("");
  }

  function pickClub(c, cityKey, countryCode) {
    const countryName = (dir.countries.find((x) => x.code === countryCode) || {}).name;
    const cityObj = (dir.cities[countryCode] || []).find((x) => x.key === cityKey) || {};
    const resolved = { ...c, cityKey, cityName: cityObj.name, countryCode, countryName };
    setClub(resolved);
    onSelect && onSelect(resolved);
  }

  const cityList = country ? (dir.cities[country] || []) : [];
  const filteredCities = cityQuery
    ? cityList.filter((c) => c.name.toLowerCase().includes(cityQuery.toLowerCase()))
    : cityList;

  const clubList = city ? (dir.clubs[city] || []) : [];
  const filteredClubs = clubQuery
    ? clubList.filter((c) =>
        c.name.toLowerCase().includes(clubQuery.toLowerCase()) ||
        c.address.toLowerCase().includes(clubQuery.toLowerCase()))
    : clubList;

  const labelStyle = {
    font: "var(--text-label)", letterSpacing: "var(--tracking-label)",
    textTransform: "uppercase", color: "var(--text-muted)", display: "block", marginBottom: 8,
  };
  const inputWrap = (disabled) => ({
    display: "flex", alignItems: "center", gap: 10,
    border: "1px solid " + (disabled ? "var(--border-default)" : "var(--border-control)"),
    borderRadius: "var(--radius-control)", padding: "11px 14px",
    background: disabled ? "var(--bf-grey-1)" : "var(--bf-white)",
  });
  const inputStyle = {
    border: "none", outline: "none", flex: 1, background: "transparent",
    font: "400 15px/1.3 var(--font-sans)", color: "var(--bf-ink)",
  };
  const optionRow = (highlighted) => ({
    padding: "10px 12px", cursor: "pointer", borderRadius: "var(--radius-control)",
    background: highlighted ? "var(--bf-purple-tint)" : "transparent",
  });

  const breadcrumbParts = [];
  if (country) breadcrumbParts.push((dir.countries.find((c) => c.code === country) || {}).name);
  if (city) breadcrumbParts.push((cityList.find((c) => c.key === city) || {}).name);
  if (club) breadcrumbParts.push(club.name);

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(45,45,45,.5)", zIndex: 300, display: "flex", alignItems: "flex-end" }}
    >
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="club-picker-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--bf-white)", width: "100%", maxHeight: "88vh", overflowY: "auto",
          borderRadius: "var(--radius-lg) var(--radius-lg) 0 0",
          padding: "var(--space-6) var(--page-gutter) calc(var(--space-6) + env(safe-area-inset-bottom, 0px))",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 4 }}>
          <div style={{ minWidth: 0 }}>
            <h3 id="club-picker-title" style={{ font: "var(--text-h3)", color: "var(--bf-ink)", margin: 0 }}>
              Selecciona tu club
            </h3>
            {breadcrumbParts.length > 0 && (
              <p style={{ font: "var(--text-caption)", color: "var(--text-muted)", margin: "4px 0 0", overflowWrap: "anywhere" }}>
                {breadcrumbParts.join(" › ")}
              </p>
            )}
          </div>
          <button
            ref={firstFocusRef}
            type="button"
            aria-label="Cerrar"
            onClick={onClose}
            style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", borderRadius: "var(--radius-control)", cursor: "pointer", color: "var(--text-muted)", flexShrink: 0 }}
          >
            <PickerIcon name="x" size={20} />
          </button>
        </div>

        {/* ── PAÍS ─────────────────────────────────────────────────────── */}
        <div style={{ marginTop: "var(--space-5)" }}>
          <label style={labelStyle}>País</label>
          {country ? (
            <button
              type="button"
              onClick={() => pickCountry(null)}
              style={{ ...inputWrap(false), width: "100%", justifyContent: "space-between", cursor: "pointer" }}
            >
              <span style={{ font: "600 15px/1.3 var(--font-sans)", color: "var(--bf-ink)" }}>
                {(dir.countries.find((c) => c.code === country) || {}).name} ✓
              </span>
              <span style={{ font: "var(--text-caption)", color: "var(--text-link)" }}>Cambiar</span>
            </button>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {dir.countries.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => pickCountry(c.code)}
                  style={{ ...inputWrap(false), width: "100%", justifyContent: "flex-start", cursor: "pointer", textAlign: "left" }}
                >
                  <span style={{ font: "600 15px/1.3 var(--font-sans)", color: "var(--bf-ink)" }}>{c.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── CIUDAD ───────────────────────────────────────────────────── */}
        <div style={{ marginTop: "var(--space-5)" }}>
          <label style={labelStyle} htmlFor="club-picker-city">Ciudad</label>
          <div style={inputWrap(!country)}>
            <span style={{ color: country ? "var(--bf-purple)" : "var(--text-muted)" }}><PickerIcon name="search" size={18} /></span>
            <input
              id="club-picker-city"
              role="combobox"
              aria-expanded={!!country}
              aria-controls="club-picker-city-listbox"
              aria-disabled={!country}
              disabled={!country}
              value={cityQuery}
              onChange={(e) => setCityQuery(e.target.value)}
              placeholder={country ? "Escribe una ciudad…" : "Elige un país primero"}
              style={inputStyle}
            />
          </div>
          {country && (
            <>
              <div id="club-picker-city-listbox" role="listbox" style={{ marginTop: 6, maxHeight: 180, overflowY: "auto" }}>
                {filteredCities.map((c) => (
                  <div
                    key={c.key}
                    role="option"
                    aria-selected={city === c.key}
                    onClick={() => pickCity(c.key)}
                    style={{ ...optionRow(city === c.key), display: "flex", justifyContent: "space-between" }}
                  >
                    <span style={{ font: "600 14px/1.3 var(--font-sans)", color: "var(--bf-ink)" }}>{c.name}</span>
                    <span style={{ font: "var(--text-caption)", color: "var(--text-muted)" }}>{c.clubCount}</span>
                  </div>
                ))}
                {filteredCities.length === 0 && (
                  <div style={{ padding: "10px 12px", font: "var(--text-body-sm)", color: "var(--text-muted)" }}>
                    No se encontraron ciudades.
                  </div>
                )}
              </div>
              <div className="sr-only" aria-live="polite">{filteredCities.length} resultados</div>
            </>
          )}
        </div>

        {/* ── CLUB ─────────────────────────────────────────────────────── */}
        <div style={{ marginTop: "var(--space-5)" }}>
          <label style={labelStyle} htmlFor="club-picker-club">Club</label>
          <div style={inputWrap(!city)}>
            <span style={{ color: city ? "var(--bf-purple)" : "var(--text-muted)" }}><PickerIcon name="search" size={18} /></span>
            <input
              id="club-picker-club"
              role="combobox"
              aria-expanded={!!city}
              aria-controls="club-picker-club-listbox"
              aria-disabled={!city}
              disabled={!city}
              value={clubQuery}
              onChange={(e) => setClubQuery(e.target.value)}
              placeholder={city ? "Escribe un club o calle…" : "Elige una ciudad primero"}
              style={inputStyle}
            />
          </div>
          {city && (
            <>
              <div id="club-picker-club-listbox" role="listbox" style={{ marginTop: 6, maxHeight: 280, overflowY: "auto" }}>
                {filteredClubs.map((c) => (
                  <div
                    key={c.id}
                    role="option"
                    aria-selected={club && club.id === c.id}
                    aria-label={c.name + ", " + c.address}
                    onClick={() => pickClub(c, city, country)}
                    style={{ ...optionRow(club && club.id === c.id), borderBottom: "1px solid var(--bf-grey-2)" }}
                  >
                    <div style={{ font: "600 14px/1.3 var(--font-sans)", color: "var(--bf-ink)" }}>{c.name}</div>
                    <div style={{ font: "var(--text-body-sm)", color: "var(--bf-ink-2)" }}>{c.address}</div>
                  </div>
                ))}
              </div>
              <div className="sr-only" aria-live="polite">{filteredClubs.length} resultados</div>
              {filteredClubs.length === 0 && (
                <div style={{ padding: "var(--space-4) 0", textAlign: "center" }}>
                  <p style={{ font: "var(--text-body-sm)", color: "var(--text-muted)", margin: "0 0 6px" }}>
                    No se encontraron clubes.
                  </p>
                  <a
                    href="#"
                    onClick={(e) => { e.preventDefault(); onManualEdit && onManualEdit(); }}
                    style={{ font: "600 14px/1.2 var(--font-sans)", color: "var(--text-link)" }}
                  >
                    Editar campo 6 manualmente →
                  </a>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

window.ClubPickerSheet = ClubPickerSheet;
