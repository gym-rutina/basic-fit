import React, { useState } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HashRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { ClubPickerSheet } from '../ClubPickerSheet.jsx';
import { ExercisePickerSheet } from '../ExercisePickerSheet.jsx';
import { EquipmentOverlaySheet } from '../EquipmentOverlaySheet.jsx';
import { EquipmentReferenceSheet } from '../EquipmentReferenceSheet.jsx';
import { ConfirmSheet } from '../ConfirmSheet.jsx';
import { LanguageSheet } from '../LanguageSheet.jsx';
import { RestoreSheet } from '../RestoreSheet.jsx';
import { GuideSheet } from '../GuideSheet.jsx';
import { I18nProvider } from '../../i18n/index.js';
import { pressSystemBack, settleHistory, resetHashTo } from '../../test-utils/history.js';

/**
 * back-closes-dialogs-and-wizard-polish AC1/AC9 — ONE Back test per SheetShell
 * consumer. The shared behaviour lives in SheetShell (sheet/backClosesDialog.test.jsx
 * proves the mechanism); this file proves no consumer opts out or swallows it:
 * each real sheet, opened over /b, is closed by one system Back (its own close
 * callback fires once, the route stays /b) and the next Back reaches /a.
 */

vi.mock('../../lib/db.js', () => ({
  readAllForBackup: vi.fn().mockResolvedValue({ rutinas: [], sessions: [] }),
  restoreFromBackup: vi.fn().mockResolvedValue(undefined),
  getClubExclusions: vi.fn().mockResolvedValue([]),
  setClubExclusions: vi.fn().mockResolvedValue(undefined),
  hasClubExclusionsRecord: vi.fn().mockResolvedValue(false),
}));

const gymsFx = vi.hoisted(() => ({
  COUNTRIES: [{ code: 'ES', names: { en: 'Spain', es: 'España', be: 'Іспанія' }, cities: [] }],
}));
vi.mock('../../data/gyms.js', () => ({
  GYM_INDEX: { metadata: { totalClubs: 1 }, countries: gymsFx.COUNTRIES },
  COUNTRIES: gymsFx.COUNTRIES,
  TOTAL_CLUBS: 1,
  citiesFor: () => [],
  loadClubs: async () => [],
  findClubById: async () => null,
  resolveLegacyGymId: async () => null,
}));

vi.mock('../../data/guideContent.js', () => ({
  GUIDE_PROMPT: '### OUTPUT\nJSON only.',
  GUIDE_HTML: { en: '<p>Guide body</p>', es: '<p>Cuerpo de la guía</p>', be: '<p>Тэкст</p>' },
}));

const CLUB = { clubId: '1ec43550fd654c7d8e23bc6c96cd2ff0', name: 'Alameda', city: 'Málaga' };
const ITEMS = [
  { key: 'prensa-pecho-g3s10', label: 'Prensa de Pecho · G3-S10' },
  { key: 'jalon-pecho-g3s20', label: 'Jalón al Pecho · G3-S20' },
];

/** [name, dialog role, (onClose) => element] */
const CONSUMERS = [
  ['ClubPickerSheet', 'dialog', (onClose) => <ClubPickerSheet onSelect={vi.fn()} onClose={onClose} />],
  ['ExercisePickerSheet', 'dialog', (onClose) => <ExercisePickerSheet items={ITEMS} selectedKey={ITEMS[0].key} onSelect={vi.fn()} onClose={onClose} />],
  ['EquipmentOverlaySheet', 'dialog', (onClose) => <EquipmentOverlaySheet club={CLUB} onClose={onClose} />],
  [
    'EquipmentReferenceSheet',
    'dialog',
    (onClose) => (
      <EquipmentReferenceSheet
        name="Matrix G3-S70"
        imageUrl="https://example.com/x.jpg"
        steps={['Ajusta el asiento']}
        videoHref="https://example.com/v"
        onClose={onClose}
      />
    ),
  ],
  ['ConfirmSheet', 'alertdialog', (onClose) => <ConfirmSheet title="¿Seguro?" primaryLabel="Sí" onPrimary={vi.fn()} cancelLabel="No" onCancel={onClose} />],
  ['LanguageSheet', 'dialog', (onClose) => <LanguageSheet onClose={onClose} />],
  ['RestoreSheet', 'dialog', (onClose) => <RestoreSheet onClose={onClose} onRestored={vi.fn()} />],
  ['GuideSheet', 'dialog', (onClose) => <GuideSheet locale="es" onClose={onClose} />],
];

function PathProbe() {
  return <output data-testid="path">{useLocation().pathname}</output>;
}

function Landing() {
  const navigate = useNavigate();
  return <button type="button" onClick={() => navigate('/b')}>go to b</button>;
}

function Host({ make, onClose }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>open the sheet</button>
      {open && make(() => { onClose(); setOpen(false); })}
    </div>
  );
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(async () => {
  cleanup();
  await settleHistory();
});

describe('every SheetShell consumer closes on the system Back (AC1, AC9)', () => {
  it.each(CONSUMERS)('%s', async (_name, role, make) => {
    resetHashTo('#/a');
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <I18nProvider initialLocale="es">
        <HashRouter>
          <PathProbe />
          <Routes>
            <Route path="/a" element={<Landing />} />
            <Route path="/b" element={<Host make={make} onClose={onClose} />} />
          </Routes>
        </HashRouter>
      </I18nProvider>
    );
    await user.click(screen.getByRole('button', { name: 'go to b' }));
    await settleHistory();
    const trigger = screen.getByRole('button', { name: 'open the sheet' });
    await user.click(trigger);
    expect(screen.getByRole(role)).toBeInTheDocument();

    await pressSystemBack();

    expect(screen.queryByRole(role)).not.toBeInTheDocument();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('path').textContent).toBe('/b');
    expect(trigger).toHaveFocus(); // AC11: focus restore unchanged

    await pressSystemBack();
    expect(screen.getByTestId('path').textContent).toBe('/a');
  });
});
