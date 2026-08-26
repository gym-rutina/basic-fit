import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import React from 'react';

/**
 * tech-debt audit 2026-08-26 F6 — registration-integrity guard for
 * `_ds_bundle.js`, the IIFE bundle the legacy DS preview pages load via a
 * script tag (ui_kits/rutina/*.html, components/…*.card.html).
 *
 * WHY THIS EXISTS: the bundle is generated OUTSIDE this repo ("builtBy":
 * "cc-design-sync"; there is no generator script here), and its exports have
 * historically been assembled by ACCUMULATION IN EXECUTION ORDER — so adding
 * a component in the wrong file order silently dropped it from the exported
 * namespace while the bundle kept evaluating clean (the trap SelectField.jsx's
 * header still warns about). Repairing the ordering in-repo is impossible —
 * the file is generated art — so the durable fix chosen is an ASSERTION:
 * every `components[]` entry declared in the machine-readable `@ds-bundle`
 * header must survive evaluation as a function on the exported namespace.
 * A regeneration that drops or mis-orders a component now fails this test
 * instead of shipping a broken preview page.
 *
 * The whole source is evaluated with `new Function` rather than imported so
 * the classic-script execution context (top-level `window` assignment and
 * all) is reproduced literally.
 */
const BUNDLE_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), '_ds_bundle.js');
const SOURCE = readFileSync(BUNDLE_PATH, 'utf8');

const HEADER_START = SOURCE.indexOf('/* @ds-bundle:');
const HEADER_JSON_START = SOURCE.indexOf('{', HEADER_START);
const HEADER_END = SOURCE.indexOf('*/', HEADER_JSON_START);
const HEADER = JSON.parse(SOURCE.slice(HEADER_JSON_START, HEADER_END));

describe('_ds_bundle.js registration integrity (tech-debt audit F6)', () => {
  beforeAll(() => {
    // The inlined react-shim reads window.React during bundle evaluation.
    window.React = React;
  });

  it('declares components in its manifest (sanity — an empty manifest guards nothing)', () => {
    expect(Array.isArray(HEADER.components)).toBe(true);
    expect(HEADER.components.length).toBeGreaterThan(0);
    expect(typeof HEADER.namespace).toBe('string');
  });

  it('exposes every manifest component as a function after evaluation', () => {
    const namespace = new Function(`${SOURCE}; return ${HEADER.namespace};`)();

    expect(namespace).toBeTruthy();
    for (const { name } of HEADER.components) {
      expect(namespace[name], `${name} is declared in the @ds-bundle manifest but missing from the evaluated export`).toBeTypeOf('function');
    }
  });
});
