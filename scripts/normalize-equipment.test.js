// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { normalizeEquipment, JHT_MANUALS_BASE } from './normalize-equipment.js';

/**
 * spec.md M12 / R8.8 / AC50b — the write-back pass extracted out of
 * `build-catalog.js` when that script and `equipment-catalog.html` were
 * deleted.
 *
 * AC50b ("a second run leaves data/equipment.json byte-identical") is NOT
 * satisfied by a straight port. `build-catalog.js:24` stamps
 * `metadata.lastUpdated = new Date()…slice(0,10)` on EVERY run, so the
 * old behaviour is byte-identical only until midnight — see tech-plan.md
 * D9. `normalizeEquipment` is therefore pure: it returns the normalised
 * object and reports whether anything actually changed, and the CLI writes
 * only when it did.
 */

const item = (overrides = {}) => ({
  id: 'g3-s10',
  modelCode: 'G3-S10',
  names: { en: 'Chest Press', es: 'Prensa de Pecho', be: 'Жым ад грудзей' },
  videos: { en: [], es: [], be: [] },
  manuals: [],
  ...overrides,
});

const doc = (equipment) => ({
  metadata: {
    lastUpdated: '2026-01-01',
    source: 'test',
    languages: ['en', 'es', 'be'],
    totalEquipment: equipment.length,
  },
  equipment,
});

describe('video placeholder resolution', () => {
  const withPlaceholder = () =>
    doc([
      item({
        videos: {
          en: [
            {
              url: 'SEARCH_REQUIRED',
              type: 'instruction',
              title: 'How to',
              note: "Search YouTube: 'Matrix chest press tutorial'",
            },
          ],
          es: [],
          be: [],
        },
      }),
    ]);

  it('replaces SEARCH_REQUIRED with a YouTube search built from the quoted term in note', () => {
    const { data } = normalizeEquipment(withPlaceholder());

    expect(data.equipment[0].videos.en[0].url).toBe(
      'https://www.youtube.com/results?search_query=Matrix%20chest%20press%20tutorial'
    );
  });

  it('falls back to the entry name when note carries no quoted term', () => {
    const input = doc([
      item({
        videos: {
          en: [{ url: 'SEARCH_REQUIRED', type: 'instruction', title: 'How to', note: 'no quotes here' }],
          es: [],
          be: [],
        },
      }),
    ]);

    expect(normalizeEquipment(input).data.equipment[0].videos.en[0].url).toContain(
      encodeURIComponent('Chest Press')
    );
  });

  it('leaves an already-resolved url alone', () => {
    const resolved = 'https://www.youtube.com/results?search_query=already%20done';
    const input = doc([
      item({ videos: { en: [{ url: resolved, type: 'instruction', title: 'x' }], es: [], be: [] } }),
    ]);

    expect(normalizeEquipment(input).data.equipment[0].videos.en[0].url).toBe(resolved);
  });
});

describe('JHT manual url rewriting', () => {
  it('rewrites a per-product /manuals/{slug} url to the searchable list page', () => {
    const input = doc([
      item({
        manuals: [
          {
            url: 'https://www.jhtsupport.com/eng/matrix/manuals/g3-s10-chest-press',
            language: 'en',
            type: 'owner',
          },
        ],
      }),
    ]);

    const manual = normalizeEquipment(input).data.equipment[0].manuals[0];
    expect(manual.url).toBe(JHT_MANUALS_BASE);
    expect(manual.searchTerm).toBe('G3-S10');
  });

  it('leaves a non-JHT manual url alone', () => {
    const url = 'https://eu.ziva.com/manuals/zvo-dbpu-1648.pdf';
    const input = doc([item({ manuals: [{ url, language: 'en', type: 'owner' }] })]);

    expect(normalizeEquipment(input).data.equipment[0].manuals[0].url).toBe(url);
  });
});

describe('purity and idempotence (AC50b, D9)', () => {
  const dirty = () =>
    doc([
      item({
        videos: {
          en: [{ url: 'SEARCH_REQUIRED', type: 'instruction', title: 'x', note: "'chest press'" }],
          es: [],
          be: [],
        },
        manuals: [{ url: 'https://www.jhtsupport.com/eng/matrix/manuals/g3-s10', language: 'en', type: 'owner' }],
      }),
    ]);

  it('does not mutate its input', () => {
    const input = dirty();
    const before = JSON.stringify(input);

    normalizeEquipment(input);

    expect(JSON.stringify(input)).toBe(before);
  });

  it('reports changed: true on the first pass and changed: false on the second', () => {
    const first = normalizeEquipment(dirty());
    expect(first.changed).toBe(true);

    const second = normalizeEquipment(first.data);
    expect(second.changed).toBe(false);
  });

  it('produces byte-identical JSON on a second pass', () => {
    const first = normalizeEquipment(dirty()).data;
    const second = normalizeEquipment(first).data;

    expect(JSON.stringify(second, null, 2)).toBe(JSON.stringify(first, null, 2));
  });

  it('leaves metadata.lastUpdated untouched when nothing changed', () => {
    // The whole of AC50b turns on this. `build-catalog.js:24` stamped the
    // date unconditionally, which makes "byte-identical on a second run"
    // true within one calendar day and false across midnight — a test that
    // passes all afternoon and fails in CI overnight.
    const clean = normalizeEquipment(dirty()).data;
    const stamp = clean.metadata.lastUpdated;

    const again = normalizeEquipment(clean);

    expect(again.changed).toBe(false);
    expect(again.data.metadata.lastUpdated).toBe(stamp);
  });

  it('stamps metadata.lastUpdated only when something actually changed', () => {
    const { data, changed } = normalizeEquipment(dirty());

    expect(changed).toBe(true);
    expect(data.metadata.lastUpdated).toBe(new Date().toISOString().slice(0, 10));
    expect(data.metadata.lastUpdated).not.toBe('2026-01-01');
  });

  it('is a no-op on an already-clean catalog', () => {
    const clean = doc([item()]);
    const { data, changed } = normalizeEquipment(clean);

    expect(changed).toBe(false);
    expect(data).toEqual(clean);
  });
});
