import { useEffect, useState } from 'react';

// The URL hash is the single source of truth for the selected park:
//   #/            -> list only
//   #/parks/<id>  -> details for <id>
const PREFIX = '#/parks/';

export function parkHref(id: string): string {
  return PREFIX + encodeURIComponent(id);
}

/** Returns the selected park id, or null when the hash selects nothing. */
export function parseHash(hash: string): string | null {
  if (!hash.startsWith(PREFIX)) return null;
  const encoded = hash.slice(PREFIX.length);
  if (encoded === '') return null;
  try {
    return decodeURIComponent(encoded);
  } catch {
    return null; // malformed %-encoding in a hand-typed URL
  }
}

/**
 * `navigations` counts hash changes after the first render. It is 0 on initial
 * load, which lets the app move focus only in response to a user navigation.
 */
export function useHashRoute(): { selectedId: string | null; navigations: number } {
  const [hash, setHash] = useState(() => window.location.hash);
  const [navigations, setNavigations] = useState(0);

  useEffect(() => {
    const onHashChange = () => {
      setHash(window.location.hash);
      setNavigations((count) => count + 1);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  return { selectedId: parseHash(hash), navigations };
}
