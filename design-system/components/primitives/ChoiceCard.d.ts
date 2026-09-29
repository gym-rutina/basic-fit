/**
 * A whole-card choice rendered as a single button (recommended / default).
 */
export interface ChoiceCardProps {
  /** Purple border + tint + badge + filled CTA look. */
  recommended?: boolean;
  title: string;
  body: string;
  /** Small caption under the body. */
  meta?: string;
  /** Text of the CTA-looking label at the bottom of the card. */
  ctaLabel: string;
  onSelect: () => void;
  /** Badge text — only shown when `recommended`. */
  badge?: string;
  style?: React.CSSProperties;
}
export declare function ChoiceCard(props: ChoiceCardProps): JSX.Element;
