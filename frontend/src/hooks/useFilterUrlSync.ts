import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../app/hooks";
import { selectFilters, setFilters } from "../features/events/eventSlice";
import { DEFAULT_FILTERS, type FilterScope } from "../features/events/filterEvents";
import { filtersFromParams, filtersToParams } from "../features/events/filterUrl";

// Keeps the store's filters and the page's query string in step. The URL wins
// when the page opens and on back/forward; after that, filter changes rewrite
// the URL in place (no new history entry per keystroke).
export const useFilterUrlSync = (scope: FilterScope): void => {
  const dispatch = useAppDispatch();
  const filters = useAppSelector(selectFilters);
  const [params, setParams] = useSearchParams();
  const search = params.toString();
  const current = filtersToParams(filters, scope).toString();
  // The query string the URL has, or is about to have.
  const urlSearch = useRef<string | null>(null);
  // Query strings written here that the location hasn't caught up with yet. The
  // router applies them as transitions, so typing can get ahead of it.
  const written = useRef<string[]>([]);
  // While the store takes in the URL's filters: the state it's heading for.
  const loading = useRef<string | null>(null);

  // URL → store.
  useEffect(() => {
    const own = written.current.indexOf(search);
    if (own !== -1) {
      written.current.splice(0, own + 1);
      return;
    }
    if (search === urlSearch.current) return;
    const fromUrl = filtersFromParams(new URLSearchParams(search), scope);
    urlSearch.current = search;
    loading.current = filtersToParams({ ...DEFAULT_FILTERS, ...fromUrl }, scope).toString();
    dispatch(setFilters(fromUrl));
  }, [dispatch, search, scope]);

  // Store → URL. Waits until the store has the URL's filters, so the stale
  // filters of the first render never overwrite the URL.
  useEffect(() => {
    if (loading.current !== null) {
      if (current === loading.current) loading.current = null;
      return;
    }
    if (current === urlSearch.current) return;
    urlSearch.current = current;
    written.current.push(current);
    setParams(current, { replace: true });
  }, [current, setParams]);
};
