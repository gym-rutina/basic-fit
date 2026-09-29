/**
 * Wizard step header: back button + "Paso N de T" live text + segmented bar.
 */
export interface StepHeaderProps {
  /** Current step, 1-based. The first `step` bar segments are filled. */
  step: number;
  /** Total number of steps (= number of bar segments). */
  total: number;
  onBack: () => void;
  /** Back button text. Default "Atrás". */
  backLabel?: string;
  /** Localized "Step N of T" text. Default "Paso {step} de {total}". */
  stepLabel?: string;
  style?: React.CSSProperties;
}
export declare function StepHeader(props: StepHeaderProps): JSX.Element;
