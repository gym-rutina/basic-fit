#!/usr/bin/env node
/**
 * Generates gyms.html — a static, human-readable gym list (id + name + address).
 * Run: node scripts/build-gyms.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const gymsPath = path.join(ROOT, 'data', 'gyms.json');
const outPath = path.join(ROOT, 'gyms.html');

const data = JSON.parse(fs.readFileSync(gymsPath, 'utf8'));
const gyms = data.gyms || [];

const cards = gyms.map((g) => `
        <article class="gym-card" id="gym-${g.id}">
          <div class="gym-id">id ${g.id}</div>
          <h2>${escapeHtml(g.name)}</h2>
          <p class="gym-address">${escapeHtml(g.address || '')}</p>
          ${g.neighborhood ? `<p class="gym-meta">${escapeHtml(g.city)} · ${escapeHtml(g.neighborhood)}</p>` : `<p class="gym-meta">${escapeHtml(g.city || '')}</p>`}
        </article>`).join('\n');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Basic-Fit gyms — Rutina</title>
  <style>
    :root {
      --bf-orange: #F36F21;
      --bf-purple: #5B21AC;
      --bf-ink: #2D2D2D;
      --bf-ink-2: #4A4A4A;
      --bf-ink-3: #757575;
      --bf-grey-1: #F5F5F5;
      --bf-grey-2: #EBEBEB;
      --bf-white: #FFFFFF;
      --font-sans: "Archivo", "Helvetica Neue", Arial, sans-serif;
      --font-display: "Archivo Expanded", "Archivo", sans-serif;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: var(--font-sans); color: var(--bf-ink-2); background: var(--bf-grey-1); line-height: 1.5; }
    .header { background: var(--bf-white); border-bottom: 1px solid var(--bf-grey-2); padding: 24px 20px 28px; }
    .header__inner { max-width: 720px; margin: 0 auto; }
    .wordmark { font: 800 15px/1 var(--font-display); color: var(--bf-orange); text-transform: uppercase; letter-spacing: .06em; margin-bottom: 12px; }
    h1 { font: 800 26px/1.15 var(--font-display); color: var(--bf-ink); text-transform: uppercase; }
    .lead { margin-top: 10px; font-size: 15px; max-width: 52ch; }
    .lead a { color: var(--bf-purple); font-weight: 600; }
    .content { max-width: 720px; margin: 0 auto; padding: 24px 20px 48px; display: grid; gap: 12px; }
    .gym-card { background: var(--bf-white); border: 1px solid var(--bf-grey-2); border-radius: 4px; padding: 16px 18px; box-shadow: 0 2px 8px rgba(38,38,38,.06); }
    .gym-id { display: inline-block; font: 700 12px/1 var(--font-sans); letter-spacing: .06em; text-transform: uppercase; color: var(--bf-white); background: var(--bf-purple); border-radius: 3px; padding: 4px 8px; margin-bottom: 10px; }
    .gym-card h2 { font: 700 18px/1.25 var(--font-sans); color: var(--bf-ink); margin-bottom: 6px; }
    .gym-address { font-size: 15px; }
    .gym-meta { font-size: 13px; color: var(--bf-ink-3); margin-top: 4px; }
    .footer { max-width: 720px; margin: 0 auto; padding: 0 20px 32px; font-size: 13px; color: var(--bf-ink-3); }
  </style>
</head>
<body>
  <header class="header">
    <div class="header__inner">
      <div class="wordmark">Basic-Fit · Rutina</div>
      <h1>Gym list</h1>
      <p class="lead">Use the <strong>id</strong> number in field 6 of the LLM prompt. Equipment badges in the
        <a href="https://gym-rutina.github.io/basic-fit/#/catalog">equipment catalog</a> use the same ids.</p>
    </div>
  </header>
  <main class="content">
${cards}
  </main>
  <p class="footer">Generated from data/gyms.json · ${new Date().toISOString().slice(0, 10)}</p>
</body>
</html>
`;

fs.writeFileSync(outPath, html, 'utf8');
console.log(`Wrote ${path.relative(ROOT, outPath)} (${gyms.length} gyms)`);

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
