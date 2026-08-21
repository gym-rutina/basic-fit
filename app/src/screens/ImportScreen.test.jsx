import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImportScreen } from './ImportScreen.jsx';
import { I18nProvider } from '../i18n/index.js';

vi.mock('../lib/db.js', () => ({
  saveActiveRutina: vi.fn(),
  getActiveRutina: vi.fn().mockResolvedValue(null),
  getActiveSession: vi.fn().mockResolvedValue(null),
  listSessions: vi.fn().mockResolvedValue([]),
}));

vi.mock('../lib/onboardingStorage.js', () => ({
  hasSeenOnboarding: vi.fn().mockReturnValue(true),
  markOnboardingSeen: vi.fn(),
}));

/**
 * pwa-ui-language AC8 (tech-plan.md D17) updated this block's mechanism, not
 * its intent: `detectGuideLocale` stopped being a second, independently
 * mockable source of truth — the guide now follows the ACTIVE UI LOCALE via
 * `useI18n()`, exactly like every other piece of chrome. Forcing English
 * here is now done the same way any other screen would be put into English
 * (`I18nProvider initialLocale="en"`) rather than by mocking a function
 * ImportScreen no longer calls. See guideConsumer.test.jsx and
 * GuideOverlay.test.jsx for the AC8 contract itself.
 */
describe('ImportScreen — LLM guide link (AC1, AC2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderEnglish() {
    return render(
      <I18nProvider initialLocale="en">
        <ImportScreen />
      </I18nProvider>
    );
  }

  it('does not show the guide overlay on mount', () => {
    renderEnglish();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens the guide overlay when the link is clicked', async () => {
    const user = userEvent.setup();
    renderEnglish();

    await user.click(screen.getByRole('link', { name: /view the llm creation guide/i }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('LLM creation guide')).toBeInTheDocument();
  });

  it('dismisses the guide overlay when the close button is clicked', async () => {
    const user = userEvent.setup();
    renderEnglish();

    await user.click(screen.getByRole('link', { name: /view the llm creation guide/i }));
    await user.click(screen.getByRole('button', { name: /close/i }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

// onboarding-screens (AC7): pending Cmok implementation — see tech-plan.md.
// Failures here are expected until Cmok adds the revisit link to
// ImportScreen.jsx.
describe('ImportScreen — onboarding revisit link (AC7)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not show the onboarding overlay on mount', () => {
    render(<ImportScreen />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens the onboarding overlay when the revisit link is clicked', async () => {
    const user = userEvent.setup();
    render(<ImportScreen />);

    await user.click(screen.getByRole('link', { name: /c[oó]mo funciona la app/i }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('dismissing the revisited onboarding overlay (Saltar) leaves ImportScreen interactive underneath (AC6)', async () => {
    const user = userEvent.setup();
    render(<ImportScreen />);

    await user.click(screen.getByRole('link', { name: /c[oó]mo funciona la app/i }));
    await user.click(screen.getByRole('button', { name: /saltar/i }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByLabelText(/rutina\.json/i)).toBeInTheDocument();
  });
});

// onboarding-request-fields R7.5, AC39 (tech-plan.md §2.5): the handout
// narrows (equipment.json/gyms.json/phase1-monday.json stop being served as
// downloads), but the in-app "load example" button is explicitly a NON-goal
// — phase1-monday.json stays in the repo, wired exactly as it is today.
describe('ImportScreen — load-example button still works (R7.5, AC39)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fills the textarea with the bundled phase1-monday.json example', async () => {
    const user = userEvent.setup();
    render(<ImportScreen />);

    await user.click(screen.getByRole('button', { name: /ejemplo/i }));

    const textarea = screen.getByLabelText(/rutina\.json/i);
    expect(textarea.value.length).toBeGreaterThan(0);
    expect(() => JSON.parse(textarea.value)).not.toThrow();
  });
});
