import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChoiceCard } from './ChoiceCard.jsx';

// import-flow-guided-first AC2/AC13 (tech-plan AD-5) — RED until Cmok creates
// ChoiceCard.jsx. The whole card is ONE button; the badge is part of its name.
describe('ChoiceCard', () => {
  const base = { title: 'Prepara un prompt', body: 'Responde unas preguntas', ctaLabel: 'Preparar prompt' };

  it('renders as a single button whose name includes title and CTA label', () => {
    render(<ChoiceCard {...base} onSelect={() => {}} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveAccessibleName(/prepara un prompt/i);
    expect(buttons[0]).toHaveAccessibleName(/preparar prompt/i);
  });

  it('includes the badge in the accessible name when recommended', () => {
    render(<ChoiceCard {...base} recommended badge="Recomendado" onSelect={() => {}} />);
    expect(screen.getByRole('button')).toHaveAccessibleName(/recomendado/i);
  });

  it('shows no badge when not recommended', () => {
    render(<ChoiceCard {...base} badge="Recomendado" onSelect={() => {}} />);
    expect(screen.queryByText('Recomendado')).not.toBeInTheDocument();
  });

  it('renders body and meta text', () => {
    render(<ChoiceCard {...base} meta="~3 min" onSelect={() => {}} />);
    expect(screen.getByText('Responde unas preguntas')).toBeInTheDocument();
    expect(screen.getByText('~3 min')).toBeInTheDocument();
  });

  it('calls onSelect on click and on keyboard activation', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<ChoiceCard {...base} onSelect={onSelect} />);
    await user.click(screen.getByRole('button'));
    screen.getByRole('button').focus();
    await user.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledTimes(2);
  });

  it('marks the recommended variant for styling hooks', () => {
    const { container, rerender } = render(<ChoiceCard {...base} recommended badge="R" onSelect={() => {}} />);
    expect(container.querySelector('[data-variant="recommended"]')).not.toBeNull();
    rerender(<ChoiceCard {...base} onSelect={() => {}} />);
    expect(container.querySelector('[data-variant="default"]')).not.toBeNull();
  });
});
