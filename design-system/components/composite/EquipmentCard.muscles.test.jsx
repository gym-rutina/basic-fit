import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EquipmentCard } from './EquipmentCard.jsx';

// pill-overflow-ux S5 — secondary muscle tags collapse into a single "+N"
// chip (AC16–AC19). MoreMusclesChip is deliberately LOCAL to EquipmentCard
// (user-ratified OQ4 — not a DS primitive), and because the design system is
// i18n-free by architecture, the chip's accessible names arrive as PROPS
// (tech-plan.md D-E). Colocated with its component since the tech-debt audit
// (2026-08-26 F3) extended vitest.config.js's include glob to design-system/**
// — like SelectField's test, it previously sat under app/src/components/.
//
// RED until Cmok edits EquipmentCard.jsx internals.

const CARD = {
  name: 'Prensa de Pecho',
  modelCode: 'G3-S10',
  series: 'G3',
  primaryMuscles: ['Pecho'],
  secondaryMuscles: ['Tríceps', 'Hombro', 'Core'],
  description: 'Desc',
};

function renderCard(props = {}) {
  return render(
    <EquipmentCard
      {...CARD}
      secondaryMoreLabel="Ver 3 músculos más"
      secondaryLessLabel="Menos"
      {...props}
    />
  );
}

describe('EquipmentCard muscle tags (pill-overflow-ux S5)', () => {
  it('renders primary tags unchanged (AC16)', () => {
    renderCard();
    expect(screen.getByText('Pecho')).toBeInTheDocument();
  });

  it('collapses secondaries into a +N chip; zero secondaries omit it entirely (AC17)', () => {
    const { rerender } = renderCard();
    // Collapsed: individual secondary chips are NOT in the document…
    expect(screen.queryByText('Tríceps')).not.toBeInTheDocument();
    // …the chip is.
    expect(screen.getByRole('button', { name: 'Ver 3 músculos más' })).toBeInTheDocument();

    rerender(<EquipmentCard {...CARD} secondaryMuscles={[]} secondaryMoreLabel="x" secondaryLessLabel="y" />);
    expect(screen.queryByRole('button', { name: /músculos más/i })).not.toBeInTheDocument();
  });

  it('is a real button with an action-named accessible name, not a bare "+2" span (AC19)', () => {
    renderCard({ secondaryMuscles: ['Hombro', 'Core'] });
    // Label prop must be re-derived by the caller per count — here the card
    // shows whatever label was passed; the assertion pins that the control is
    // a BUTTON carrying that name rather than a decorative span.
    const chip = screen.getByRole('button', { name: 'Ver 3 músculos más' });
    expect(chip.tagName).toBe('BUTTON');
  });

  it('expands in place into the individual secondary chips on tap (AC18)', async () => {
    const user = userEvent.setup();
    renderCard();

    await user.click(screen.getByRole('button', { name: 'Ver 3 músculos más' }));

    expect(screen.getByText('Tríceps')).toBeInTheDocument();
    expect(screen.getByText('Hombro')).toBeInTheDocument();
    expect(screen.getByText('Core')).toBeInTheDocument();
    // Collapse affordance appears with its own label.
    expect(screen.getByRole('button', { name: 'Menos' })).toBeInTheDocument();
  });

  it('expansion of one card does not expand another (AC18 independence)', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <EquipmentCard {...CARD} secondaryMoreLabel="Ver 3 músculos más" secondaryLessLabel="Menos" />
        <EquipmentCard
          name="Jalón al Pecho"
          modelCode="G3-S20"
          series="G3"
          primaryMuscles={['Espalda']}
          secondaryMuscles={['Bíceps']}
          description="D"
          secondaryMoreLabel="Ver 1 músculo más"
          secondaryLessLabel="Menos"
        />
      </div>
    );

    await user.click(screen.getByRole('button', { name: 'Ver 3 músculos más' }));

    expect(screen.getByText('Tríceps')).toBeInTheDocument();          // first expanded
    expect(screen.queryByText('Bíceps')).not.toBeInTheDocument();    // second still collapsed
  });
});
