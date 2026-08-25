import { describe, it, expect } from 'vitest';
import { validateInviteUrl } from './inviteUrl.js';

// club-invite-link — AC4/AC5/AC6: the security matrix for the invite URL.
//
// AC4 is non-waivable (spec.md): the stored string becomes an href target, so
// a `javascript:` value would be script execution in the app's own origin.
// The contract under test is an https-only ALLOWLIST via the URL constructor
// — never a denylist, never a regex on the scheme (tech-plan.md D-A; Bagnik
// fails any denylist implementation).
//
// Failures here are expected until Cmok implements inviteUrl.js (red-first,
// onboardingStorage.test.js precedent).

describe('validateInviteUrl — accepts valid https URLs (AC7)', () => {
  it('accepts a plain https URL and returns the input verbatim', () => {
    const result = validateInviteUrl('https://invite.basic-fit.com/xKb92a1c');
    expect(result.ok).toBe(true);
    // D1 opacity: the stored value is the trimmed ORIGINAL string, never a
    // URL-normalized href — the URL object is used for the verdict then discarded.
    expect(result.url).toBe('https://invite.basic-fit.com/xKb92a1c');
  });

  it('accepts any https host — the app does not judge whether it is Basic-Fit (AC7)', () => {
    expect(validateInviteUrl('https://example.com/some/share/link?qr=1').ok).toBe(true);
  });

  it('keeps query strings and fragments untouched in the returned url', () => {
    const raw = 'https://invite.basic-fit.com/xKb92a1c?lang=es#top';
    expect(validateInviteUrl(raw).url).toBe(raw);
  });
});

describe('validateInviteUrl — rejects unsafe schemes by NAME (AC4)', () => {
  // Each entry must be rejected with reason 'unsafe-scheme' and the scheme
  // named normalized-lowercase with its colon — that name is what the UI alert
  // shows («javascript:» no es seguro), so precision here is user-visible.
  const cases = [
    ['javascript:alert(document.cookie)', 'javascript:'],
    ['data:text/html,<script>alert(1)</script>', 'data:'],
    ['blob:https://example.com/uuid', 'blob:'],
    ['file:///C:/Windows/system32', 'file:'],
    ['http://invite.basic-fit.com/xKb92a1c', 'http:'],
    // Bagnik gate discriminators: schemes NOT named by the spec must still be
    // rejected. A denylist covering exactly the five entries above passes
    // those assertions while letting arbitrary unsafe schemes through — only
    // a protocol === 'https:' allowlist rejects these (tech-plan.md D-A).
    ['ftp://files.example.com/doc', 'ftp:'],
    ['vbscript:msgbox(1)', 'vbscript:'],
  ];

  for (const [input, scheme] of cases) {
    it(`rejects ${scheme} values — never storable`, () => {
      const result = validateInviteUrl(input);
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('unsafe-scheme');
      expect(result.scheme).toBe(scheme);
    });
  }

  it('rejects mixed-case JaVaScRiPt: via constructor normalization', () => {
    const result = validateInviteUrl('JaVaScRiPt:alert(1)');
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('unsafe-scheme');
    expect(result.scheme).toBe('javascript:');
  });
});

describe('validateInviteUrl — rejects values that are not URLs (AC5)', () => {
  it('rejects plain prose', () => {
    expect(validateInviteUrl('hola mundo')).toMatchObject({ ok: false, reason: 'invalid-url' });
  });

  it('rejects protocol-relative //host (no scheme to name → invalid-url bucket)', () => {
    // Refinement vs ux-design §2: new URL('//host') throws without a base, so
    // there is no scheme to name in an alert; both buckets reject and nothing
    // is stored either way, so AC4 holds (tech-plan.md D-A).
    const result = validateInviteUrl('//invite.basic-fit.com/xKb92a1c');
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('invalid-url');
  });

  it('rejects empty and whitespace-only input', () => {
    expect(validateInviteUrl('')).toMatchObject({ ok: false, reason: 'invalid-url' });
    expect(validateInviteUrl('   ')).toMatchObject({ ok: false, reason: 'invalid-url' });
  });
});

describe('validateInviteUrl — trims before validating and storing (AC6)', () => {
  it('accepts a padded https URL and returns it trimmed', () => {
    const result = validateInviteUrl('  https://invite.basic-fit.com/xKb92a1c\n');
    expect(result.ok).toBe(true);
    expect(result.url).toBe('https://invite.basic-fit.com/xKb92a1c');
  });

  it('names the scheme of a PADDED unsafe value — trim happens first', () => {
    const result = validateInviteUrl('  javascript:alert(1) ');
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('unsafe-scheme');
    expect(result.scheme).toBe('javascript:');
  });
});
