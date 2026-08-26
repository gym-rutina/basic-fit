#!/usr/bin/env node
/**
 * Copies deployable static assets into dist/ for GitHub Pages deployment,
 * mirroring each file's source subpath. Today that is the LLM guide's
 * rutina.schema.json only (DATA_FILES) so the guide's same-origin "download"
 * card can offer it. The former root-level HTML page list (PAGES) is kept as
 * an (empty) extension point after both static-page families were retired —
 * retire-static-pages AC3; jsDelivr serves .html as text/plain, so anything
 * re-added here must be hosted on GitHub Pages to render in a browser.
 *
 * onboarding-request-fields Q1/R7.2/R7.3 (tech-plan.md §2.9): DATA_FILES
 * stays narrowed to the schema only — equipment.json, gyms.json and
 * phase1-monday.json are not handed out (R7.3/AC38).
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PAGES = [];
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
