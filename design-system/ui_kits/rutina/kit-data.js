// Shared demo data for the Basic-Fit rutina UI kit (abbreviated from data/equipment.json)
window.BF_KIT_DATA = {
  equipment: [
    { id: "g3-s70", name: { es: "Prensa de Piernas", en: "Leg Press", be: "Жым нагамі" }, model: "G3-S70", cat: "legs", kind: "machine",
      img: "https://images.jhtassets.com/9051c73da092604e62d75966c281c425455fcc41/transformed/w_300",
      prim: ["Cuádriceps"], sec: ["Glúteos"], weight: 45,
      desc: { es: "Prensa de piernas sentado para el tren inferior.", en: "Seated leg press for lower body.", be: "Жым нагамі седзячы для ніжняй часткі цела." } },
    { id: "g3-s10", name: { es: "Prensa de Pecho", en: "Chest Press", be: "Жым ад грудзей" }, model: "G3-S10", cat: "chest", kind: "machine",
      img: "https://images.jhtassets.com/aade812e103cdbcfeebf40679e3a74723a65ef68/transformed/w_300",
      prim: ["Pectoral mayor"], sec: ["Tríceps", "Deltoides anterior"], weight: 32,
      desc: { es: "Imita el press de banca en un entorno controlado.", en: "Mimics bench press in a controlled environment.", be: "Імітуе жым штангі ў кантраляваным асяроддзі." } },
    { id: "g3-s30", name: { es: "Jalón al Pecho", en: "Lat Pulldown", be: "Цяга верхняга блока" }, model: "G3-S30", cat: "back", kind: "machine",
      prim: ["Dorsal ancho"], sec: ["Bíceps"], weight: 39,
      desc: { es: "Jalón vertical para el desarrollo de la espalda.", en: "Vertical pull for back development.", be: "Вертыкальная цяга для развіцця спіны." } },
    { id: "g3-s20", name: { es: "Prensa de Hombros", en: "Shoulder Press", be: "Жым ад плячэй" }, model: "G3-S20", cat: "shoulders", kind: "machine",
      prim: ["Deltoides"], sec: ["Tríceps"],
      desc: { es: "Press vertical de hombros sentado.", en: "Seated overhead shoulder press.", be: "Жым ад плячэй седзячы." } },
    { id: "g3-s40", name: { es: "Curl de Bíceps", en: "Arm Curl", be: "Згінанне рук" }, model: "G3-S40", cat: "arms", kind: "machine",
      prim: ["Bíceps"], sec: [], weight: 20,
      desc: { es: "Curl de bíceps con apoyo de brazos.", en: "Supported biceps curl.", be: "Згінанне рук на біцэпс з упорам." } },
    { id: "g3-s50", name: { es: "Abdominales", en: "Abdominal", be: "Прэс" }, model: "G3-S50", cat: "core", kind: "machine",
      prim: ["Recto abdominal"], sec: [],
      desc: { es: "Crunch abdominal con resistencia regulable.", en: "Weighted abdominal crunch.", be: "Скручванні з рэгулюемым супрацівам." } },
    // Below: 3 items added for gym-directory-and-catalog (2026-08-09) — verified real model
    // codes from research-brief-equipment.md, chosen specifically to demo M11's "kind vs
    // category" split. g3-ms24 is the case that must disagree: kind=machine (Máquinas in the
    // overlay) but cat=free-weights (Peso libre in Catálogo) — see ux-design.md §3.
    { id: "g3-ms24", name: { es: "Polea Ajustable Aura", en: "Aura Adjustable Pulley", be: "Рэгулюемы блок Aura" }, model: "G3-MS24", cat: "free-weights", kind: "machine",
      img: "https://images.jhtassets.com/9051c73da092604e62d75966c281c425455fcc41/transformed/w_300",
      prim: ["Full-body"], sec: [],
      desc: { es: "Polea ajustable multiposición para trabajo funcional.", en: "Multi-position adjustable pulley for functional training.", be: "Шматпазіцыйны рэгулюемы блок для функцыянальнай трэніроўкі." } },
    { id: "zvo-dbpu-1648", name: { es: "Mancuernas ZVO", en: "ZVO Dumbbells", be: "Гантэлі ZVO" }, model: "ZVO-DBPU-1648", cat: "free-weights", kind: "free-weight",
      prim: ["Full-body"], sec: [],
      desc: { es: "Mancuernas de acero con revestimiento de uretano.", en: "Solid steel dumbbells with urethane coating.", be: "Стальныя гантэлі з уретанавым пакрыццём." } },
    { id: "zsl-tdym-0250", name: { es: "Esterilla de Yoga", en: "Yoga Mat", be: "Кілімок для ёгі" }, model: "ZSL-TDYM-0250", cat: "accessories", kind: "accessory",
      prim: ["Full-body"], sec: [],
      desc: { es: "Esterilla TPE para trabajo en suelo.", en: "TPE mat for floor work.", be: "TPE-кілімок для працы на падлозе." } },
  ],
  cats: [
    { id: "all", es: "Todas" }, { id: "chest", es: "Pecho" }, { id: "back", es: "Espalda" },
    { id: "shoulders", es: "Hombros" }, { id: "arms", es: "Brazos" }, { id: "legs", es: "Piernas" }, { id: "core", es: "Core" },
    { id: "free-weights", es: "Peso libre" }, { id: "accessories", es: "Accesorios" },
  ],
  kinds: [
    { id: "machine", es: "Máquinas" }, { id: "free-weight", es: "Peso libre" }, { id: "accessory", es: "Accesorios" },
  ],
};

// ─── gym-directory-and-catalog (2026-08-09) — club directory mock data ──────
// Illustrative sample only, NOT the real scraped directory (spec.md's real
// dataset is 1,726 clubs across 6 countries via Store-FinderMap/-More). City
// clubCount badges show the real measured per-city figures where known
// (Madrid 37, spec.md §"City sizes"); the `clubs` arrays only enumerate a
// representative subset per city, same "abbreviated" convention as `equipment`
// above — enough to prove the search/scroll/address-disambiguation UI, not a
// full mirror of the build-time scraper's output.
window.BF_KIT_DIRECTORY = {
  totalClubs: 1726,
  countries: [
    { code: "ES", name: "España" },
    { code: "FR", name: "Francia" },
    { code: "BE", name: "Bélgica" },
    { code: "NL", name: "Países Bajos" },
    { code: "LU", name: "Luxemburgo" },
    { code: "DE", name: "Alemania" },
  ],
  cities: {
    ES: [
      { key: "malaga", name: "Málaga", clubCount: 7 },
      { key: "madrid", name: "Madrid", clubCount: 37 },
      { key: "valencia", name: "Valencia", clubCount: 14 },
    ],
    FR: [
      { key: "paris", name: "Paris", clubCount: 62 },
      { key: "lyon", name: "Lyon", clubCount: 9 },
    ],
    BE: [{ key: "bruselas", name: "Bruselas", clubCount: 21 }],
    NL: [{ key: "amsterdam", name: "Ámsterdam", clubCount: 18 }],
    LU: [{ key: "luxemburgo-ciudad", name: "Luxemburgo", clubCount: 10 }],
    DE: [{ key: "berlin", name: "Berlín", clubCount: 12 }],
  },
  clubs: {
    malaga: [
      { id: "c-ma-1", name: "Centro Comercial Alameda", address: "Avda. Andalucía s/n, Centro Comercial Alameda" },
      { id: "c-ma-2", name: "Málaga Centro", address: "Calle Especería 3" },
      { id: "c-ma-3", name: "Málaga Este", address: "Calle Martínez Maldonado 55" },
    ],
    // Illustrative — index badge shows the real measured count (37); only a
    // representative subset is enumerated (see file header note).
    madrid: [
      { id: "c-mad-1", name: "Conangla", address: "Calle Alcalde Conangla 9" },
      { id: "c-mad-2", name: "Federico García Lorca C.C. Vialia", address: "C/ Federico García Lorca, 1, Centro Comercial Vialia" },
      { id: "c-mad-3", name: "Calle San Juan 33", address: "Calle San Juan 33" },
      { id: "c-mad-4", name: "Gran Vía", address: "Gran Vía 45" },
      { id: "c-mad-5", name: "Atocha", address: "Calle Atocha 12" },
      { id: "c-mad-6", name: "La Vaguada", address: "C.C. La Vaguada, Av. Monforte de Lemos 36" },
      { id: "c-mad-7", name: "Alcalá 120", address: "Calle Alcalá 120" },
      { id: "c-mad-8", name: "Chamberí", address: "Calle Fuencarral 98" },
    ],
    valencia: [
      { id: "c-val-1", name: "Colón", address: "Calle Colón 24" },
      { id: "c-val-2", name: "Ruzafa", address: "Calle Sueca 8" },
      { id: "c-val-3", name: "Nou Campanar", address: "Av. de Burjassot 91" },
    ],
    paris: [
      { id: "c-par-1", name: "République", address: "12 Boulevard Voltaire" },
      { id: "c-par-2", name: "Montparnasse", address: "45 Rue de Rennes" },
      { id: "c-par-3", name: "Bastille", address: "8 Rue de la Roquette" },
    ],
    lyon: [
      { id: "c-lyo-1", name: "Part-Dieu", address: "22 Rue Garibaldi" },
      { id: "c-lyo-2", name: "Bellecour", address: "5 Place Bellecour" },
    ],
    bruselas: [
      { id: "c-bru-1", name: "Ixelles", address: "Chaussée d'Ixelles 210" },
      { id: "c-bru-2", name: "Anderlecht", address: "Rue Wayez 88" },
    ],
    amsterdam: [
      { id: "c-ams-1", name: "Zuid", address: "Beethovenstraat 60" },
      { id: "c-ams-2", name: "Centrum", address: "Nieuwendijk 15" },
    ],
    "luxemburgo-ciudad": [
      { id: "c-lux-1", name: "Gare", address: "Avenue de la Gare 33" },
      { id: "c-lux-2", name: "Kirchberg", address: "Rue Alphonse Weicker 4" },
    ],
    berlin: [
      { id: "c-ber-1", name: "Mitte", address: "Alexanderplatz 7" },
      { id: "c-ber-2", name: "Charlottenburg", address: "Kantstraße 120" },
    ],
  },
};

// Selection persistence (mockup stand-in for the real app's local persistence
// — spec.md R5.5 "the selection persists locally"). ClubPickerSheet and
// CatalogScreen both read/write this so picking a club in one place is
// reflected in the other, same as the real ClubPickerSheet/EquipmentOverlaySheet
// being shared singletons (ux-design.md's Interaction summary).
window.BF_KIT_CLUB_STORE = {
  get() {
    try { return JSON.parse(localStorage.getItem("bf_mock_club")); } catch (e) { return null; }
  },
  set(club) {
    try { localStorage.setItem("bf_mock_club", JSON.stringify(club)); } catch (e) { /* ignore */ }
  },
  clear() {
    try { localStorage.removeItem("bf_mock_club"); } catch (e) { /* ignore */ }
  },
  getExcluded(clubId) {
    if (!clubId) return [];
    try { return JSON.parse(localStorage.getItem("bf_mock_excluded_" + clubId)) || []; } catch (e) { return []; }
  },
  setExcluded(clubId, ids) {
    if (!clubId) return;
    try { localStorage.setItem("bf_mock_excluded_" + clubId, JSON.stringify(ids)); } catch (e) { /* ignore */ }
  },
};
