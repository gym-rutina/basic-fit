import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StepHeader } from './StepHeader.jsx';

// import-flow-guided-first AC7/AC13 (tech-plan AD-5) — RED until Cmok creates
// StepHeader.jsx. Back button + "Paso N de T" + segmented progress bar.
describe('StepHeader', () => {
  it('announces "Paso N de T" in a polite live region', () => {
    render(<StepHeader step={1} total={2} onBack={() => {}} />);
    const text = screen.getByText(/paso 1 de 2/i);
    expect(text.closest('[aria-live="polite"]')).not.toBeNull();
  });

  it('renders the back control as a real button and calls onBack', async () => {
    const onBack = vi.fn();
    render(<StepHeader step={2} total={2} onBack={onBack} />);
    await userEvent.setup().click(screen.getByRole('button', { name: /atr[aá]s/i }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('honours a custom back label', () => {
    render(<StepHeader step={1} total={2} onBack={() => {}} backLabel="Back" />);
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
  });

  it('draws `total` segments, the first `step` filled, and hides the bar from AT', () => {
    const { container } = render(<StepHeader step={1} total={3} onBack={() => {}} />);
    const bar = container.querySelector('[data-testid="step-bar"]');
    expect(bar).not.toBeNull();
    expect(bar).toHaveAttribute('aria-hidden', 'true');
    const segs = bar.querySelectorAll('[data-filled]');
    expect(segs).toHaveLength(3);
    expect([...segs].map((s) => s.getAttribute('data-filled'))).toEqual(['true', 'false', 'false']);
  });

  it('keeps the back button at least 44px tall', () => {
    render(<StepHeader step={1} total={2} onBack={() => {}} />);
    expect(parseInt(screen.getByRole('button', { name: /atr[aá]s/i }).style.minHeight, 10)).toBeGreaterThanOrEqual(44);
  });
});
