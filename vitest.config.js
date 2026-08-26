import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    // design-system/ is included so DS primitives are testable IN PLACE
    // (tech-debt audit 2026-08-26 F3) — SelectField.test.jsx and
    // EquipmentCard.muscles.test.jsx previously lived under app/src/components/
    // as an undocumented workaround for this very glob.
    include: ['app/src/**/*.test.{js,jsx}', 'scripts/**/*.test.js', 'design-system/**/*.test.{js,jsx}'],
    globals: false,
    setupFiles: ['./app/src/test-setup.js'],
  },
});
