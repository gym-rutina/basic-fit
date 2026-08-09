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
