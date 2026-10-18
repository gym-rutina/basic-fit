import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EquipmentReferenceSheet } from './EquipmentReferenceSheet.jsx';

afterEach(() => {
  vi.restoreAllMocks();
});

const RICH = {
  name: 'Matrix Aura G3-S70 — Prensa de Piernas',
  imageUrl: 'https://example.com/press.jpg',
  steps: ['Ajusta el asiento', 'Empuja controladamente'],
  videoHref: 'https://www.youtube.com/results?search_query=leg+press',
};

describe('EquipmentReferenceSheet', () => {
  it('renders dialog with title, image, Técnica steps, and YouTube link', () => {
    render(<EquipmentReferenceSheet {...RICH} onClose={vi.fn()} />);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'equipment-sheet-title');
    expect(screen.getByText(RICH.name)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: RICH.name })).toHaveAttribute('src', RICH.imageUrl);
    // The photo must never be upscaled: natural size, capped at sheet width.
    expect(screen.getByRole('img', { name: RICH.name })).toHaveStyle({ width: 'auto', maxWidth: '100%' });
    expect(screen.getByText('Técnica')).toBeInTheDocument();
    expect(screen.getByText('Ajusta el asiento')).toBeInTheDocument();
    expect(screen.getByText('Empuja controladamente')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /ver tutorial en youtube/i });
    expect(link).toHaveAttribute('href', RICH.videoHref);
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('omits image, Técnica, and video when those props are empty', () => {
    render(
      <EquipmentReferenceSheet
        name="Name only"
        imageUrl={undefined}
        steps={[]}
        videoHref={undefined}
        onClose={vi.fn()}
      />
    );

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.queryByText('Técnica')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /youtube/i })).not.toBeInTheDocument();
    expect(screen.getByText('Name only')).toBeInTheDocument();
  });

  it('focuses the close button on mount', () => {
    render(<EquipmentReferenceSheet {...RICH} onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: /cerrar/i })).toHaveFocus();
  });

  it('calls onClose when Escape is pressed', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<EquipmentReferenceSheet {...RICH} onClose={onClose} />);

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when the close button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<EquipmentReferenceSheet {...RICH} onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: /cerrar/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when the scrim (overlay backdrop) is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { container } = render(<EquipmentReferenceSheet {...RICH} onClose={onClose} />);

    // Outer fixed overlay is the scrim; dialog is nested inside it.
    const scrim = container.firstElementChild;
    expect(scrim).toBeTruthy();
    await user.click(scrim);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does not call onClose when clicking inside the sheet body', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<EquipmentReferenceSheet {...RICH} onClose={onClose} />);

    await user.click(screen.getByText('Técnica'));
    expect(onClose).not.toHaveBeenCalled();
  });
});

/**
 * exercise-level-tracking (spec.md AC18′ — restated at UAT).
 *
 * UAT decision A2: the catalog machine video is REMOVED from the exercise
 * context. This sheet renders exactly one video link, and that link is the
 * exercise tutorial its caller composed with buildVideoQuery. The machine's own
 * clip stays in the Catálogo tab, which this feature does not touch.
 *
 * The sheet is titled with the MACHINE (it must match the row that opened it),
 * so the link label is what tells the user the tutorial is for the exercise —
 * hence the optional videoLabel prop.
 */
describe('EquipmentReferenceSheet — exercise tutorial link (AC18′)', () => {
  const TUTORIAL = 'https://www.youtube.com/results?search_query=Press%20de%20Hombro%20t%C3%A9cnica';

  it('renders the custom videoLabel when the caller names the exercise', () => {
    render(
      <EquipmentReferenceSheet
        {...RICH}
        videoHref={TUTORIAL}
        videoLabel="Ver técnica de «Press de Hombro» en YouTube"
        onClose={vi.fn()}
      />
    );

    const link = screen.getByRole('link', { name: /ver técnica de «Press de Hombro»/i });
    expect(link).toHaveAttribute('href', TUTORIAL);
  });

  it('keeps the generic label when no videoLabel is passed', () => {
    render(<EquipmentReferenceSheet {...RICH} onClose={vi.fn()} />);

    expect(screen.getByRole('link', { name: /ver tutorial en youtube/i })).toBeInTheDocument();
  });

  it('renders exactly ONE link — no separate machine-video link', () => {
    render(
      <EquipmentReferenceSheet
        {...RICH}
        videoHref={TUTORIAL}
        videoLabel="Ver técnica de «Press de Hombro» en YouTube"
        onClose={vi.fn()}
      />
    );

    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.queryByRole('link', { name: /vídeo de la máquina/i })).not.toBeInTheDocument();
  });

  it('opens in a new tab safely and says so for screen readers', () => {
    render(<EquipmentReferenceSheet {...RICH} videoHref={TUTORIAL} onClose={vi.fn()} />);

    const link = screen.getByRole('link', { name: /youtube/i });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(link).toHaveAccessibleName(/se abre en una pestaña nueva/i);
  });
});

describe('EquipmentReferenceSheet — club reporting action (2026-10-06 / 2026-10-17 UAT)', () => {
  const REPORT = { equipmentId: 'g3-s70', canReport: true, reported: false, onNotHere: vi.fn(), onUndo: vi.fn() };
  const moreButton = () => screen.queryByRole('button', { name: /más acciones/i });
  const menuItem = () => screen.queryByRole('menuitem', { name: 'Mi club no tiene esta máquina' });
  async function openConfirm(user) {
    await user.click(moreButton());
    await user.click(menuItem());
  }

  it('puts the action behind a «⋯» header menu: closed by default, one item when opened, never a loose button', async () => {
    const user = userEvent.setup();
    render(<EquipmentReferenceSheet {...RICH} reporting={REPORT} onClose={vi.fn()} />);

    expect(moreButton()).toHaveAttribute('aria-expanded', 'false');
    expect(menuItem()).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /no tiene/i })).not.toBeInTheDocument();

    await user.click(moreButton());
    expect(moreButton()).toHaveAttribute('aria-expanded', 'true');
    expect(menuItem()).toHaveFocus();
  });

  it('renders no menu, no status text when reporting is absent or cannot report (catalog callers, no club)', () => {
    const { rerender } = render(<EquipmentReferenceSheet {...RICH} onClose={vi.fn()} />);
    expect(moreButton()).not.toBeInTheDocument();
    expect(screen.queryByText(/Reportado\./)).not.toBeInTheDocument();

    rerender(<EquipmentReferenceSheet {...RICH} reporting={{ ...REPORT, canReport: false }} onClose={vi.fn()} />);
    expect(moreButton()).not.toBeInTheDocument();
  });

  it('the tutorial link is the LAST thing in the sheet — after the report region, image and Técnica', async () => {
    const user = userEvent.setup();
    render(<EquipmentReferenceSheet {...RICH} reporting={REPORT} onClose={vi.fn()} />);
    await openConfirm(user);

    const link = screen.getByRole('link', { name: /youtube/i });
    const FOLLOWING = Node.DOCUMENT_POSITION_FOLLOWING;
    expect(screen.getByRole('group').compareDocumentPosition(link) & FOLLOWING).toBeTruthy();
    expect(screen.getByText('Técnica').compareDocumentPosition(link) & FOLLOWING).toBeTruthy();
  });

  it('picking the menu item only opens the confirmation; onNotHere fires solely from its confirm button, and Cancelar fires nothing', async () => {
    const onNotHere = vi.fn();
    const user = userEvent.setup();
    render(<EquipmentReferenceSheet {...RICH} reporting={{ ...REPORT, onNotHere }} onClose={vi.fn()} />);

    await openConfirm(user);
    expect(onNotHere).not.toHaveBeenCalled();
    expect(menuItem()).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: /ocultar esta máquina/i })).toBeInTheDocument();
    // Safe default: focus lands on Cancelar, not on the destructive confirm.
    expect(screen.getByRole('button', { name: /cancelar/i })).toHaveFocus();

    await user.click(screen.getByRole('button', { name: /cancelar/i }));
    expect(onNotHere).not.toHaveBeenCalled();
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
    expect(moreButton()).toHaveFocus();
  });

  it('confirming reports once; the polite confirmation then replaces the «⋯», focus goes to ✕, and Deshacer calls onUndo and brings «⋯» back', async () => {
    const onNotHere = vi.fn();
    const onUndo = vi.fn();
    const user = userEvent.setup();
    const props = { ...REPORT, onNotHere, onUndo };
    const { rerender } = render(<EquipmentReferenceSheet {...RICH} reporting={props} onClose={vi.fn()} />);

    await openConfirm(user);
    await user.click(screen.getByRole('button', { name: 'Sí, mi club no la tiene' }));
    expect(onNotHere).toHaveBeenCalledTimes(1);
    expect(onNotHere).toHaveBeenCalledWith('g3-s70');
    expect(screen.queryByRole('group')).not.toBeInTheDocument();

    rerender(<EquipmentReferenceSheet {...RICH} reporting={{ ...props, canReport: false, reported: true }} onClose={vi.fn()} />);
    expect(moreButton()).not.toBeInTheDocument();
    const live = [...document.querySelectorAll('[aria-live="polite"], [role="status"]')].map((n) => n.textContent).join(' | ');
    expect(live).toMatch(/Reportado\. Se ha ocultado/);
    // The control that had focus vanished, so focus moves to ✕ instead of <body>.
    expect(screen.getByRole('button', { name: /cerrar/i })).toHaveFocus();

    await user.click(screen.getByRole('button', { name: /deshacer/i }));
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(onUndo).toHaveBeenCalledWith('g3-s70');

    // The parent restores the machine: canReport returns, reported clears.
    rerender(<EquipmentReferenceSheet {...RICH} reporting={{ ...props, canReport: true, reported: false }} onClose={vi.fn()} />);
    expect(screen.queryByText(/Reportado\./)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /deshacer/i })).not.toBeInTheDocument();
    expect(moreButton()).toHaveFocus();
  });

  it('offers no Deshacer when the caller passes no onUndo', () => {
    render(<EquipmentReferenceSheet {...RICH} reporting={{ equipmentId: 'g3-s70', canReport: false, reported: true, onNotHere: vi.fn() }} onClose={vi.fn()} />);
    expect(screen.getByText(/Reportado\./)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /deshacer/i })).not.toBeInTheDocument();
  });

  it('Escape closes an open menu first (sheet stays), the next Escape closes the sheet', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<EquipmentReferenceSheet {...RICH} reporting={REPORT} onClose={onClose} />);

    await user.click(moreButton());
    await user.keyboard('{Escape}');
    expect(menuItem()).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(moreButton()).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('a tap outside the open menu closes it without closing the sheet', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<EquipmentReferenceSheet {...RICH} reporting={REPORT} onClose={onClose} />);

    await user.click(moreButton());
    await user.click(screen.getByText('Técnica'));
    expect(menuItem()).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});
