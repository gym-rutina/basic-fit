/**
 * club-invite-link (tech-plan.md D-A) — the pure validator for the club
 * invite URL. No DOM, no storage, no fetch: the app treats the URL as opaque
 * (spec.md D1), so this function's ONLY job is AC4/AC5/AC6's safety gate.
 *
 * Pipeline (order matters): trim → `new URL(trimmed)` → `protocol === 'https:'`.
 *
 * The https allowlist is the ENTIRE scheme check — deliberately no denylist,
 * no regex on the scheme, no substring sniffing (spec.md AC4 is non-waivable;
 * Bagnik fails any blocklist implementation). The URL constructor normalises
 * `url.protocol` to lowercase, so mixed-case `JaVaScRiPt:` is handled by the
 * constructor itself. Protocol-relative `//host` throws without a base and
 * lands in `invalid-url` — there is no scheme to name in an alert.
 *
 * The returned `url` is the trimmed ORIGINAL string, never `u.href`: the URL
 * object exists only for the scheme verdict and is then discarded. Normalising
 * through `u.href` would re-encode and reformat the user's link — pointless
 * parsing that D1 forbids for a value we promise never to inspect.
 */

/**
 * @param {unknown} raw
 * @returns {{ ok: true, url: string }
 *   | { ok: false, reason: 'unsafe-scheme', scheme: string }
 *   | { ok: false, reason: 'invalid-url' }}
 */
export function validateInviteUrl(raw) {
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    // Unparseable: prose, empty/whitespace-only input, protocol-relative //host
    // (no base) — nothing to open, and no scheme to name either way (AC5).
    return { ok: false, reason: 'invalid-url' };
  }
  if (parsed.protocol !== 'https:') {
    // Normalized lowercase with its colon by the URL constructor itself —
    // this exact name is what the settings alert shows («javascript:» …).
    return { ok: false, reason: 'unsafe-scheme', scheme: parsed.protocol };
  }
  return { ok: true, url: trimmed };
}

/**
 * club-invite-amendments A1 (U1) — users paste the invite link together with
 * surrounding message text; find the link for them instead of failing the
 * whole paste.
 *
 * Extraction only FINDS candidates — it never relaxes the gate. Every
 * candidate goes through the SAME validateInviteUrl allowlist above, so AC4's
 * guarantee is untouched: nothing reaches storage that didn't pass it.
 *
 * - Candidates are explicit-`https://` tokens ONLY. Scheme-less `www.…` is NOT
 *   auto-prefixed: inventing a scheme on a credential link is exactly the risk
 *   AC4 exists to close, so an unmatched paste degrades to today's
 *   `invalid-url` path.
 * - Trailing prose punctuation (`[.,;:)\]]`) is stripped per candidate so a
 *   sentence-final dot never corrupts the token.
 * - Candidates run through the validator in order; the FIRST ok wins (multiple
 *   links in one paste = first takes it, documented behaviour). Since every
 *   candidate is https-scheme by construction, validation can only fail with
 *   zero matches — hence failure surfaces as `invalid-url`, and error UX is
 *   byte-identical to the pre-extraction behaviour.
 */
export function extractInviteUrl(raw) {
  const source = typeof raw === 'string' ? raw : '';
  const candidates = source.matchAll(/https:\/\/[^\s<>"'`]+/gi);
  for (const [token] of candidates) {
    const result = validateInviteUrl(token.replace(/[.,;:)\]]+$/, ''));
    if (result.ok) return result;
  }
  return { ok: false, reason: 'invalid-url' };
}
