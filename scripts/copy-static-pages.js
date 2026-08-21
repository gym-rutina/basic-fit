#!/usr/bin/env node
/**
 * Copies root-level static HTML pages and DATA SOURCES JSON files into dist/
 * for GitHub Pages deployment. jsDelivr serves .html as text/plain (by
 * design), so these pages must be hosted on GitHub Pages to render in the
 * browser. The DATA SOURCES file is also copied (mirroring its source
 * subpath) so the LLM guide's same-origin "download" card can offer it.
 *
 * onboarding-request-fields Q1/R7.2/R7.3 (tech-plan.md §2.9): DATA_FILES
 * narrows to the schema only — equipment.json, gyms.json and
 * phase1-monday.json are no longer handed out (R7.3/AC38). The hand-rolled
 * ZIP writer (buildDataArchive) and the zlib/CRC-32 machinery that existed
 * only to serve it are DELETED, not kept around unused: a one-entry zip
 * would just reintroduce the "my chat can't open a zip" failure mode this
 * feature exists to remove.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PAGES = ['gyms.html'];
const DATA_FILES = ['data/schema/rutina.schema.json'];

function copyStaticAssets(root, dist) {
  if (!fs.existsSync(dist)) return;
  for (const page of PAGES) {
    const src = path.join(root, page);
    if (!fs.existsSync(src)) continue;
    fs.copyFileSync(src, path.join(dist, page));
  }
  for (const rel of DATA_FILES) {
    const src = path.join(root, rel);
    if (!fs.existsSync(src)) continue;
    const dest = path.join(dist, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

if (require.main === module) {
  const dist = path.join(ROOT, 'dist');
  if (!fs.existsSync(dist)) {
    console.warn('dist/ not found — skipping static page copy (run after vite build)');
    process.exit(0);
  }
  copyStaticAssets(ROOT, dist);
  console.log('Copied static assets → dist/');
}

module.exports = { copyStaticAssets, PAGES, DATA_FILES };
