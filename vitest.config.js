import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Node >= 25 turns Web Storage on by default, and its global `localStorage` getter (undefined
// without --localstorage-file) shadows jsdom's — ~480 suites then die on `localStorage.clear()`.
// Turn the Node one off in the test workers. Gated on the flag existing: Node 20 (CI) rejects
// an unknown `--no-experimental-webstorage` as a bad option.
const execArgv = process.allowedNodeEnvironmentFlags.has('--experimental-webstorage')
  ? ['--no-experimental-webstorage']
  : [];

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    poolOptions: { forks: { execArgv } },
    // design-system/ is included so DS primitives are testable IN PLACE
    // (tech-debt audit 2026-08-26 F3) — SelectField.test.jsx and
    // EquipmentCard.muscles.test.jsx previously lived under app/src/components/
    // as an undocumented workaround for this very glob.
    include: ['app/src/**/*.test.{js,jsx}', 'scripts/**/*.test.js', 'design-system/**/*.test.{js,jsx}'],
    globals: false,
    setupFiles: ['./app/src/test-setup.js'],
  },
});
