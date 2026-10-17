import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { createBackend } from './index.js';
import { LocalBackend } from './LocalBackend.js';

/**
 * React access to the backend seam. Mirrors I18nProvider's shape: a context
 * seeded with a working default (LocalBackend), so a component rendered WITHOUT
 * the provider still behaves, as the offline app.
 *
 * The provider is inert: it renders exactly its children (no wrapper element,
 * no UI), writes nothing and makes no request on mount.
 *
 * `useBackend()` returns:
 *   - client:  the BackendClient (Local or Http)
 *   - session: the current Session | null (re-render trigger for auth state)
 *   - refreshSession(): re-read after a sign-in/out done outside React
 *   - isRemote: true only when a real server is configured
 *
 * Screens do their own try/catch on client methods and use
 * shouldDegradeSilently() from ./errors.js to choose between "revert to
 * offline" and "show this problem"; the provider does not centralise that.
 */

const DEFAULT_VALUE = Object.freeze({
  client: new LocalBackend(),
  session: null,
  refreshSession: () => {},
  isRemote: false,
});

const BackendContext = createContext(DEFAULT_VALUE);

/**
 * @param {{ children?: React.ReactNode, client?: import('./types').BackendClient }} props
 *   client: inject a backend (tests, previews); default is createBackend().
 */
export function BackendProvider({ children, client: injected }) {
  const client = useMemo(() => injected ?? createBackend(), [injected]);
  const [session, setSession] = useState(() => client.getSession());

  const refreshSession = useCallback(() => {
    setSession(client.getSession());
  }, [client]);

  const value = useMemo(
    () => ({ client, session, refreshSession, isRemote: client.isRemote }),
    [client, session, refreshSession]
  );

  return <BackendContext.Provider value={value}>{children}</BackendContext.Provider>;
}

export function useBackend() {
  return useContext(BackendContext);
}
