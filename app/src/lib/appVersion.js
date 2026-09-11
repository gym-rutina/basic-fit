/**
 * full-data-backup — the app version string for the backup envelope (spec AC2).
 * Its own module so tests never assert a value that changes every build.
 * Cross-root JSON import — same mechanism app/src/lib/validateImport.js uses
 * for data/equipment.json (vite server.fs.allow includes the repo root).
 */
import pkg from '../../../package.json';

export const APP_VERSION = pkg.version;
