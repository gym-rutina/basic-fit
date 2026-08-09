/**
 * Exercise card for routine day sections: number, name, muscle tags,
 * parameter grid, equipment line, machine photo, technique steps, video link.
 */
export interface ExerciseCardProps {
  /** Position within the day (1-based) */
  number: React.ReactNode;
  name: React.ReactNode;
  /** First entry rendered as primary muscle */
  muscles?: React.ReactNode[];
  /** Parameter blocks, e.g. {label:"Series × Repeticiones", value:"3 × 12"} */
  details?: { label: React.ReactNode; value: React.ReactNode }[];
  /** "Matrix Aura G3-S70 — Prensa de Piernas" */
  equipment?: React.ReactNode;
  alternative?: React.ReactNode;
  imageUrl?: string;
  /** Technique steps (ordered) */
  steps?: React.ReactNode[];
  videoHref?: string;
  /** Overrides the default "Ver tutorial en YouTube →" — e.g. to name the exercise. */
  videoLabel?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function ExerciseCard(props: ExerciseCardProps): JSX.Element;
