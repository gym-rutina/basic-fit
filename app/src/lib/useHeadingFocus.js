import { useEffect, useRef } from 'react';

/**
 * import-flow-guided-first AC13 — moves focus to the screen's <h1> on mount
 * (route change), so screen-reader and keyboard users land on the new screen.
 * Attach the returned ref to the heading and give it tabIndex={-1}.
 */
export function useHeadingFocus() {
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return ref;
}
