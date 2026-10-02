import { defaultT } from '../i18n/index.js';

/**
 * Muscle-group slug -> display label. Covers every slug used across
 * data/equipment.json's muscleGroup.primary/secondary (verified via the
 * shipped 27-item dataset) — the same vocabulary rutina.schema.json's
 * exercises[].muscleGroups is authored in, so one map serves both the
 * per-exercise Tag labels (ExerciseCard) and the day "focus" summary
 * (ProgramScreen's Training days row, tech-plan.md's explicit
 * requirement: never read a focus string from an authored field).
 *
 * pwa-ui-language AC6: this is UI chrome, not data (tech-plan.md's own
 * classification) — the label text follows the active UI locale, `t`
 * defaulting to the es-pinned translator (D4) so every untouched call site
 * keeps its Spanish output.
 */
const MUSCLE_KEYS = {
  'anterior-deltoid': 'muscle.anteriorDeltoid',
  biceps: 'muscle.biceps',
  brachialis: 'muscle.brachialis',
  calves: 'muscle.calves',
  core: 'muscle.core',
  'erector-spinae': 'muscle.erectorSpinae',
  forearms: 'muscle.forearms',
  glutes: 'muscle.glutes',
  'gluteus-medius': 'muscle.gluteusMedius',
  hamstrings: 'muscle.hamstrings',
  'hip-adductors': 'muscle.hipAdductors',
  'inner-thigh': 'muscle.innerThigh',
  'latissimus-dorsi': 'muscle.latissimusDorsi',
  'medial-deltoid': 'muscle.medialDeltoid',
  'middle-trapezius': 'muscle.middleTrapezius',
  obliques: 'muscle.obliques',
  'pectoralis-major': 'muscle.pectoralisMajor',
  quadriceps: 'muscle.quadriceps',
  'rear-deltoid': 'muscle.rearDeltoid',
  'rectus-abdominis': 'muscle.rectusAbdominis',
  rhomboids: 'muscle.rhomboids',
  'tensor-fasciae-latae': 'muscle.tensorFasciaeLatae',
  triceps: 'muscle.triceps',
  'upper-chest': 'muscle.upperChest',
};

export function muscleGroupLabel(slug, t = defaultT) {
  const key = MUSCLE_KEYS[slug];
  return key ? t(key) : slug;
}

export function muscleGroupLabels(slugs = [], t = defaultT) {
  return slugs.map((slug) => muscleGroupLabel(slug, t));
}

/** Unique labels across every exercise in a day, first-seen order, capped at `limit` — the day-summary "focus" string. */
export function dayFocusLabels(exercises = [], { limit = 4, t = defaultT } = {}) {
  const seen = new Set();
  const labels = [];
  for (const ex of exercises) {
    for (const slug of ex.muscleGroups || []) {
      if (seen.has(slug)) continue;
      seen.add(slug);
      labels.push(muscleGroupLabel(slug, t));
      if (labels.length >= limit) return labels;
    }
  }
  return labels;
}
