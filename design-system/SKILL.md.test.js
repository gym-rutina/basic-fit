// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * design-system-sync-fixes AC1 — SKILL.md is the first file read whenever the
 * design skill is invoked, so its "Components live in …" line must name the
 * REAL directories. On disk (and in readme.md's Index) they are
 * primitives / composite / sections; the stale line listed
 * core / data / routine / catalog / navigation.
 *
 * Red-first: fails until Cmok corrects design-system/SKILL.md.
 */
const skill = readFileSync(fileURLToPath(new URL('./SKILL.md', import.meta.url)), 'utf8');

describe('design-system/SKILL.md — component directory names (AC1)', () => {
  it('names the real component groups: primitives, composite, sections', () => {
    expect(skill).toMatch(/components\/\{?primitives\s*,\s*composite\s*,\s*sections/);
  });

  it('no longer lists the stale set (core/data/routine/catalog/navigation)', () => {
    expect(skill).not.toMatch(/core\s*,\s*data\s*,\s*routine\s*,\s*catalog\s*,\s*navigation/);
  });
});
