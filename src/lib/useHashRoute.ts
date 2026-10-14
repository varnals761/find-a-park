import { useCallback, useEffect, useMemo, useState } from 'react';
import { parseQuery, type DatasetName, type Filters } from './filters';

// The URL hash is the single source of truth for what the page shows:
//   #/                       -> list only
//   #/parks/<id>             -> details for <id>
//   ...?rating=4&amenity=x   -> filters and dataset, after the path
const PREFIX = '#/parks/';

/** Splits "#/parks/a?rating=4" into path "#/parks/a" and query "?rating=4". */
export function splitHash(hash: string): { path: string; query: string } {
  const index = hash.indexOf('?');
  if (index === -1) return { path: hash, query: '' };
  const query = hash.slice(index);
  return { path: hash.slice(0, index), query: query === '?' ? '' : query };
}

/** An id is percent-encoded, so a literal "?" always starts the query. */
export function parkHref(id: string, query = ''): string {
  return PREFIX + encodeURIComponent(id) + query;
}

export function listHref(query = ''): string {
  return '#/' + query;
}

/** Returns the selected park id, or null when the hash selects nothing. */
export function parseHash(hash: string): string | null {
  const { path } = splitHash(hash);
  if (!path.startsWith(PREFIX)) return null;
  const encoded = path.slice(PREFIX.length);
  if (encoded === '') return null;
  try {
    return decodeURIComponent(encoded);
  } catch {
    return null; // malformed %-encoding in a hand-typed URL
  }
}

export type HashRoute = {
  selectedId: string | null;
  filters: Filters;
  dataset: DatasetName;
  /** The raw query ("" or "?a=b"), for building links that keep filters. */
  query: string;
  /**
   * Counts hash changes after the first render. It is 0 on initial load, which
   * lets the app move focus only in response to a user navigation. Filter
   * edits do NOT increment it, so changing a filter never moves focus.
   */
  navigations: number;
  /** Replaces the query in place (no history entry, no focus change). */
  setQuery: (query: string) => void;
};

export function useHashRoute(): HashRoute {
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

  const { query } = splitHash(hash);
  const parsed = useMemo(() => parseQuery(query), [query]);

  // replaceState does not fire hashchange, so state is updated directly and
  // `navigations` is left alone.
  const setQuery = useCallback((nextQuery: string) => {
    const { path } = splitHash(window.location.hash);
    const next = (path === '' ? '#/' : path) + nextQuery;
    window.history.replaceState(null, '', next);
    setHash(next);
  }, []);

  return {
    selectedId: parseHash(hash),
    filters: parsed.filters,
    dataset: parsed.dataset,
    query,
    navigations,
    setQuery,
  };
}
