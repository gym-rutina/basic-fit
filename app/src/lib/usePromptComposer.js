import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GUIDE_PROMPT } from '../data/guideContent.js';
import { EQUIPMENT } from '../data/equipment.js';
import { composePrompt } from './promptEquipment.js';
import { readPromptRequest, writePromptRequest } from './promptRequestStorage.js';
import { readClub, writeClub } from './clubStorage.js';
import { useClubExclusions } from './useClubExclusions.js';
import { listSessions } from './db.js';
import { buildExportPayload } from './exportFormat.js';
import { copyText } from './copyText.js';
import { tFor, useI18n } from '../i18n/index.js';

/** Controlled-input-safe shape (never undefined for text fields) seeded from
 * the SAME persisted record OnboardingOverlay writes. */
function draftFromRecord(record) {
  return {
    field1: record.field1 ?? '',
    field2: record.field2 ?? '',
    field3: record.field3,
    field4: record.field4 ?? '',
    field5: record.field5 ?? '',
  };
}

/**
 * Prompt-composition state, extracted from the deleted GuideOverlay
 * (import-flow-guided-first AD-1). Owns: the request draft (persisted on every
 * edit), the club, session-history inclusion, the composed `promptText`, and
 * the copy action.
 *
 * Builds its own translator from the locale it renders (`tFor(active)`), like
 * GuideOverlay did — `locale` overrides the UI locale from context.
 *
 * @param {{locale?: string}} [opts]
 */
export function usePromptComposer({ locale } = {}) {
  const { locale: uiLocale } = useI18n();
  const active = locale ?? uiLocale;
  const t = tFor(active);

  const [draft, setDraft] = useState(() => draftFromRecord(readPromptRequest()));
  const [club, setClubState] = useState(() => readClub());
  const { excludedIds } = useClubExclusions(club?.clubId ?? null);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef(null);

  // listSessions() is async; the prompt must not block first paint.
  // `sessions === null` means "still loading".
  const [sessions, setSessions] = useState(null);
  // Checked by default on every mount, never persisted.
  const [includeSessions, setIncludeSessions] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve()
      .then(() => listSessions())
      .then((s) => {
        if (!cancelled) setSessions(s);
      })
      .catch(() => {
        if (!cancelled) setSessions([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => () => window.clearTimeout(copyTimer.current), []);

  const sessionsAvailable = Boolean(sessions && sessions.length > 0);
  const sessionsMarkdown = useMemo(() => {
    if (!sessionsAvailable) return '';
    return buildExportPayload(sessions, {}, { t, locale: active }).markdown;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- t is rebuilt per render from `active`
  }, [sessions, sessionsAvailable, active]);
  const sessionsIncluded = sessionsAvailable && includeSessions;

  const setField = useCallback((key, value) => {
    setDraft((d) => {
      const next = { ...d, [key]: value };
      writePromptRequest(next);
      return next;
    });
  }, []);

  const toggleDay = useCallback((n) => {
    setDraft((d) => {
      const next = { ...d, field3: d.field3 === n ? undefined : n };
      writePromptRequest(next);
      return next;
    });
  }, []);

  const setClub = useCallback((selected) => {
    if (selected) writeClub(selected);
    setClubState(selected);
  }, []);

  const promptText = useMemo(
    () =>
      composePrompt({
        answers: draft,
        equipment: EQUIPMENT,
        lang: active,
        excludedIds,
        club,
        sessionsMarkdown,
        sessionsIncluded,
        guidePromptText: GUIDE_PROMPT,
      }),
    [draft, active, excludedIds, club, sessionsMarkdown, sessionsIncluded]
  );

  const copy = useCallback(async () => {
    const outcome = await copyText(promptText);
    if (outcome === 'copied') {
      setCopied(true);
      window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopied(false), 2000);
    }
    return outcome;
  }, [promptText]);

  return {
    draft,
    setField,
    toggleDay,
    club,
    setClub,
    excludedIds,
    sessionsAvailable,
    includeSessions,
    setIncludeSessions,
    promptText,
    copied,
    copy,
  };
}
