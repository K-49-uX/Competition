import { useEffect } from 'react';

const BASE = 'AfyaConnect';

/**
 * Set <title> for the lifetime of the calling component.
 * Pass a falsy value to reset to the default title.
 */
export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · ${BASE}` : `${BASE} — Healthcare for Refugees`;
  }, [title]);
}
