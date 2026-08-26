import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../../../design-system/components/primitives/Icon.jsx';
import { SheetShell, SheetCloseButton } from './sheet/SheetShell.jsx';
import { COUNTRIES, citiesFor, loadClubs } from '../data/gyms.js';
import { filterClubs, foldForSearch } from '../lib/clubFilter.js';
import { writeClub } from '../lib/clubStorage.js';
import { useI18n } from '../i18n/index.js';

/**
 * Three dependent comboboxes — country → city → club (spec.md R5.1-R5.6,
 * AC36/AC39/AC46, tech-plan.md D1/D3, tech-plan-build-b.md D19/D20/D22).
 *
 * `design-system/ui_kits/rutina/ClubPickerSheet.jsx` is a STRUCTURAL
 * reference only, not a port (D20): it reads `window.BF_KIT_DIRECTORY` and
 * hardcodes Spanish literals. This component matches its structure — bottom
 * sheet, three stacked dependent fields, breadcrumb-free but otherwise the
 * same disabled/listbox/option shape — written fresh against i18n keys and
 * the real `app/src/data/gyms.js` module (D2).
 *
 * Every club option's accessible name is `"{name}, {address}"` (D7/X9) —
 * the address is what makes two clubs whose name is literally the street
 * distinguishable to a screen reader.
 *
 * Props:
 *   onSelect(club): called with {countryCode, clubId, name, city, address}
 *   onClose(): called on ✕ / Escape (with no field's listbox open) / scrim
 *   returnFocusTo?: {current: HTMLElement} — focus target restored on unmount,
 *     overriding the default "whatever was focused before open" (ConfirmSheet's
 *     own convention)
 */
export function ClubPickerSheet({ onSelect, onClose, returnFocusTo }) {
  const { t, locale } = useI18n();

  const [expandedField, setExpandedField] = useState(null); // 'country' | 'city' | 'club' | null

  const [countryQuery, setCountryQuery] = useState('');
  const [countryCode, setCountryCode] = useState(null);
  const [countryActive, setCountryActive] = useState(-1);

  const [cityQuery, setCityQuery] = useState('');
  const [cityKey, setCityKey] = useState(null);
  const [cityActive, setCityActive] = useState(-1);

  const [clubQuery, setClubQuery] = useState('');
  const [clubActive, setClubActive] = useState(-1);

  const [clubs, setClubs] = useState([]);

  // Shared with SheetShell: the shell autofocuses the ✕ on mount and restores
  // focus to `returnFocusTo` (or the previously focused element) on unmount.
  const closeRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    if (!countryCode) {
      setClubs([]);
      return undefined;
    }
    loadClubs(countryCode).then((loaded) => {
      if (!cancelled) setClubs(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [countryCode]);

  // Re-focusing a field that already carries a SELECTED value (its query
  // text still equals that selection's own label, unedited since) must show
  // every option again, not just the one that matched itself — otherwise the
  // stale query silently filters out every other option and re-opening the
  // country field to change countries shows nothing to change TO. The bypass
  // only fires while the displayed text is exactly the selection's label; the
  // instant the user types anything else, normal filtering resumes.
  const countrySelectedLabel = useMemo(() => {
    if (!countryCode) return null;
    const c = COUNTRIES.find((c) => c.code === countryCode);
    return c ? c.names[locale] || c.names.es : null;
  }, [countryCode, locale]);

  const countryOptions = useMemo(() => {
    const activeQuery = countryQuery === countrySelectedLabel ? '' : countryQuery;
    const folded = foldForSearch(activeQuery);
    return COUNTRIES.filter((c) => !folded || foldForSearch(c.names[locale] || c.names.es).includes(folded));
  }, [countryQuery, countrySelectedLabel, locale]);

  const citySelectedLabel = useMemo(() => {
    if (!cityKey) return null;
    const c = citiesFor(countryCode).find((c) => c.key === cityKey);
    return c ? c.name : null;
  }, [countryCode, cityKey]);

  const cityOptions = useMemo(() => {
    const all = citiesFor(countryCode);
    const activeQuery = cityQuery === citySelectedLabel ? '' : cityQuery;
    const folded = foldForSearch(activeQuery);
    return folded ? all.filter((c) => foldForSearch(c.name).includes(folded)) : all;
  }, [countryCode, cityQuery, citySelectedLabel]);

  const clubsInCity = useMemo(() => {
    // D6a: club records no longer carry cityKey; match on the display name
    // of the selected city entry instead. This is exact (not approximate)
    // because buildCountryFile's city field IS displayNameByKey.get(cityKey) —
    // the same name the index's cities[].name carries.
    const selectedCity = citiesFor(countryCode).find((c) => c.key === cityKey);
    return selectedCity ? clubs.filter((c) => c.city === selectedCity.name) : [];
  }, [clubs, countryCode, cityKey]);
  const clubOptions = useMemo(() => filterClubs(clubsInCity, clubQuery), [clubsInCity, clubQuery]);

  function pickCountry(country) {
    setCountryCode(country.code);
    setCountryQuery(country.names[locale] || country.names.es);
    setCityKey(null);
    setCityQuery('');
    setClubQuery('');
    setExpandedField(null);
  }

  function resetCountry() {
    setCountryCode(null);
    setCountryQuery('');
    setCityKey(null);
    setCityQuery('');
    setClubQuery('');
  }

  function pickCity(city) {
    setCityKey(city.key);
    setCityQuery(city.name);
    setClubQuery('');
    setExpandedField(null);
  }

  function pickClub(club) {
    const country = COUNTRIES.find((c) => c.code === countryCode);
    const record = {
      countryCode,
      clubId: club.id,
      name: club.name,
      city: club.city,
      address: club.address,
      countryName: country ? country.names[locale] || country.names.es : undefined,
    };
    setClubQuery(`${club.name}, ${club.address}`);
    setExpandedField(null);
    writeClub(record);
    onSelect && onSelect(record);
  }

  function fieldKeyDown(e, { options, active, setActive, onSelectOption, fieldName }) {
    const isOpen = expandedField === fieldName;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setExpandedField(fieldName);
        setActive(0);
        return;
      }
      setActive((i) => Math.min(options.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      if (isOpen && active >= 0 && options[active]) {
        e.preventDefault();
        onSelectOption(options[active]);
      }
    }
  }

  const labelStyle = {
    font: 'var(--text-label)',
    letterSpacing: 'var(--tracking-label)',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    display: 'block',
    marginBottom: 8,
  };
  const inputWrap = (disabled) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    border: '1px solid ' + (disabled ? 'var(--border-default)' : 'var(--border-control)'),
    borderRadius: 'var(--radius-control)',
    padding: '11px 14px',
    background: disabled ? 'var(--bf-grey-1)' : 'var(--bf-white)',
  });
  const inputStyle = {
    border: 'none',
    outline: 'none',
    flex: 1,
    minWidth: 0,
    background: 'transparent',
    font: '400 15px/1.3 var(--font-sans)',
    color: 'var(--bf-ink)',
  };
  const optionRow = (highlighted) => ({
    padding: '10px 12px',
    cursor: 'pointer',
    borderRadius: 'var(--radius-control)',
    background: highlighted ? 'var(--bf-purple-tint)' : 'transparent',
  });

  return (
    <SheetShell
      onClose={onClose}
      labelledBy="club-picker-title"
      initialFocusRef={closeRef}
      returnFocusTo={returnFocusTo}
      maxHeight="88vh"
      onEscape={() => {
        // First Escape collapses an open listbox (keeping the partial
        // selection visible); only a bare sheet closes. ux-design §5.
        if (expandedField) {
          setExpandedField(null);
        } else {
          onClose && onClose();
        }
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
        <h3 id="club-picker-title" style={{ font: 'var(--text-h3)', color: 'var(--bf-ink)', margin: 0 }}>
          {t('club.pickerTitle')}
        </h3>
        <SheetCloseButton ref={closeRef} onClick={onClose} />
      </div>

        {/* ── COUNTRY ──────────────────────────────────────────────────── */}
      <div style={{ marginTop: 'var(--space-5)' }}>
        <label style={labelStyle} htmlFor="club-picker-country">
          {t('club.country')}
        </label>
        <div style={inputWrap(false)}>
          <Icon name="search" size={18} style={{ color: 'var(--bf-purple)', flexShrink: 0 }} />
          <input
            id="club-picker-country"
            role="combobox"
            aria-label={t('club.country')}
            aria-expanded={expandedField === 'country'}
            aria-controls="club-picker-country-listbox"
            aria-activedescendant={
              expandedField === 'country' && countryActive >= 0 ? `club-picker-country-option-${countryActive}` : undefined
            }
            value={countryQuery}
            onFocus={() => {
              setExpandedField('country');
              setCountryActive(-1);
            }}
            onChange={(e) => {
              setCountryQuery(e.target.value);
              if (countryCode) resetCountry();
              setExpandedField('country');
            }}
            onKeyDown={(e) =>
              fieldKeyDown(e, {
                options: countryOptions,
                active: countryActive,
                setActive: setCountryActive,
                onSelectOption: pickCountry,
                fieldName: 'country',
              })
            }
            style={inputStyle}
          />
          {countryCode && (
            <button type="button" onClick={resetCountry} style={{ font: 'var(--text-caption)', color: 'var(--text-link)', background: 'none', border: 'none', cursor: 'pointer' }}>
              {t('club.change')}
            </button>
          )}
        </div>
        {expandedField === 'country' && (
          <div id="club-picker-country-listbox" role="listbox" aria-label={t('club.country')} style={{ marginTop: 6, maxHeight: 180, overflowY: 'auto' }}>
            {countryOptions.map((c, i) => (
              <div
                key={c.code}
                id={`club-picker-country-option-${i}`}
                role="option"
                aria-selected={countryCode === c.code}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pickCountry(c)}
                style={optionRow(i === countryActive)}
              >
                <span style={{ font: '600 14px/1.3 var(--font-sans)', color: 'var(--bf-ink)' }}>{c.names[locale] || c.names.es}</span>
              </div>
            ))}
          </div>
        )}
        {/* Persistent, not gated on `expandedField === 'country'`: a
            selection collapses the field (pickCountry sets expandedField
            null) in the SAME render as the option count changing, and a
            live region that unmounts in that instant announces nothing —
            screen readers need the node to still exist to read the update
            (R5.4/AC46, "on every filter change"). */}
        <div className="sr-only" aria-live="polite">
          {t('club.resultsCount', { n: countryOptions.length })}
        </div>
      </div>

      {/* ── CITY ─────────────────────────────────────────────────────── */}
      <div style={{ marginTop: 'var(--space-5)' }}>
        <label style={labelStyle} htmlFor="club-picker-city">
          {t('club.city')}
        </label>
        <div style={inputWrap(!countryCode)}>
          <Icon name="search" size={18} style={{ color: countryCode ? 'var(--bf-purple)' : 'var(--text-muted)', flexShrink: 0 }} />
          <input
            id="club-picker-city"
            role="combobox"
            aria-label={t('club.city')}
            aria-expanded={expandedField === 'city'}
            aria-controls="club-picker-city-listbox"
            aria-disabled={!countryCode}
            disabled={!countryCode}
            aria-activedescendant={expandedField === 'city' && cityActive >= 0 ? `club-picker-city-option-${cityActive}` : undefined}
            value={cityQuery}
            placeholder={countryCode ? t('club.cityPlaceholder') : t('club.cityPlaceholderDisabled')}
            onFocus={() => {
              setExpandedField('city');
              setCityActive(-1);
            }}
            onChange={(e) => {
              setCityQuery(e.target.value);
              if (cityKey) {
                setCityKey(null);
                setClubQuery('');
              }
              setExpandedField('city');
            }}
            onKeyDown={(e) =>
              fieldKeyDown(e, { options: cityOptions, active: cityActive, setActive: setCityActive, onSelectOption: pickCity, fieldName: 'city' })
            }
            style={inputStyle}
          />
        </div>
        {!countryCode && (
          <p style={{ font: 'var(--text-caption)', color: 'var(--text-muted)', margin: '6px 0 0' }}>{t('club.selectCountryFirst')}</p>
        )}
        {expandedField === 'city' && countryCode && (
          <div id="club-picker-city-listbox" role="listbox" aria-label={t('club.city')} style={{ marginTop: 6, maxHeight: 180, overflowY: 'auto' }}>
            {cityOptions.map((c, i) => (
              <div
                key={c.key}
                id={`club-picker-city-option-${i}`}
                role="option"
                aria-selected={cityKey === c.key}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pickCity(c)}
                style={{ ...optionRow(i === cityActive), display: 'flex', justifyContent: 'space-between' }}
              >
                <span style={{ font: '600 14px/1.3 var(--font-sans)', color: 'var(--bf-ink)' }}>{c.name}</span>
                <span style={{ font: 'var(--text-caption)', color: 'var(--text-muted)' }}>{c.clubCount}</span>
              </div>
            ))}
            {cityOptions.length === 0 && (
              <div style={{ padding: '10px 12px', font: 'var(--text-body-sm)', color: 'var(--text-muted)' }}>{t('club.noCitiesFound')}</div>
            )}
          </div>
        )}
        {/* Persistent — see the country field's identical comment above. */}
        {countryCode && (
          <div className="sr-only" aria-live="polite">
            {t('club.resultsCount', { n: cityOptions.length })}
          </div>
        )}
      </div>

      {/* ── CLUB ─────────────────────────────────────────────────────── */}
      <div style={{ marginTop: 'var(--space-5)' }}>
        <label style={labelStyle} htmlFor="club-picker-club">
          {t('club.club')}
        </label>
        <div style={inputWrap(!cityKey)}>
          <Icon name="search" size={18} style={{ color: cityKey ? 'var(--bf-purple)' : 'var(--text-muted)', flexShrink: 0 }} />
          <input
            id="club-picker-club"
            role="combobox"
            aria-label={t('club.club')}
            aria-expanded={expandedField === 'club'}
            aria-controls="club-picker-club-listbox"
            aria-disabled={!cityKey}
            disabled={!cityKey}
            aria-activedescendant={expandedField === 'club' && clubActive >= 0 ? `club-picker-club-option-${clubActive}` : undefined}
            value={clubQuery}
            placeholder={cityKey ? t('club.clubPlaceholder') : t('club.clubPlaceholderDisabled')}
            onFocus={() => {
              setExpandedField('club');
              setClubActive(-1);
            }}
            onChange={(e) => {
              setClubQuery(e.target.value);
              setExpandedField('club');
            }}
            onKeyDown={(e) =>
              fieldKeyDown(e, { options: clubOptions, active: clubActive, setActive: setClubActive, onSelectOption: pickClub, fieldName: 'club' })
            }
            style={inputStyle}
          />
        </div>
        {!cityKey && countryCode && (
          <p style={{ font: 'var(--text-caption)', color: 'var(--text-muted)', margin: '6px 0 0' }}>{t('club.selectCityFirst')}</p>
        )}
        {expandedField === 'club' && cityKey && (
          <>
            <div id="club-picker-club-listbox" role="listbox" aria-label={t('club.club')} style={{ marginTop: 6, maxHeight: 280, overflowY: 'auto' }}>
              {clubOptions.map((c, i) => (
                <div
                  key={c.id}
                  id={`club-picker-club-option-${i}`}
                  role="option"
                  aria-selected={false}
                  aria-label={`${c.name}, ${c.address}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pickClub(c)}
                  style={{ ...optionRow(i === clubActive), borderBottom: '1px solid var(--bf-grey-2)' }}
                >
                  <div style={{ font: '600 14px/1.3 var(--font-sans)', color: 'var(--bf-ink)' }}>{c.name}</div>
                  <div style={{ font: 'var(--text-body-sm)', color: 'var(--bf-ink-2)' }}>{c.address}</div>
                </div>
              ))}
            </div>
            {clubOptions.length === 0 && (
              <div style={{ padding: 'var(--space-4) 0', textAlign: 'center' }}>
                <p style={{ font: 'var(--text-body-sm)', color: 'var(--text-muted)', margin: '0 0 6px' }}>{t('club.noClubsFound')}</p>
                <button
                  type="button"
                  onClick={() => {
                    setExpandedField(null);
                    onClose && onClose();
                  }}
                  style={{ font: '600 14px/1.2 var(--font-sans)', color: 'var(--text-link)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  {t('club.editField6Manually')}
                </button>
              </div>
            )}
          </>
        )}
        {/* Persistent — see the country field's identical comment above. */}
        {cityKey && (
          <div className="sr-only" aria-live="polite">
            {t('club.resultsCount', { n: clubOptions.length })}
          </div>
        )}
      </div>
    </SheetShell>
  );
}
