// Count checks that catch a source silently breaking (an API change, a block,
// an empty page) before stale or missing data goes unnoticed.

export const MAX_DROP_RATIO = 0.7;
// Small sources swing a lot (2 food events one day, 0 the next), so only check
// for drops once the previous count is large enough to mean something.
export const MIN_PREVIOUS_FOR_DROP_CHECK = 10;

export interface RunCounts {
  fetched: number;
  normalized: number;
  published: number;
}

// `previousPublished` counts the source's previously published events that are still current.
export const assessCounts = (
  source: string,
  counts: RunCounts,
  previousPublished: number | null,
  { allowEmpty = false }: { allowEmpty?: boolean } = {},
): string[] => {
  // A small calendar may have nothing coming up, but not while events it listed
  // before are still upcoming: then the feed broke or was emptied.
  const mayBeEmpty = allowEmpty && (previousPublished ?? 0) === 0;
  if (!mayBeEmpty && counts.fetched === 0) return [`${source}: source returned 0 events.`];
  if (!mayBeEmpty && counts.normalized === 0) {
    return [`${source}: fetched ${counts.fetched} events but none normalized.`];
  }

  if (previousPublished !== null && previousPublished >= MIN_PREVIOUS_FOR_DROP_CHECK) {
    const drop = 1 - counts.published / previousPublished;
    if (drop > MAX_DROP_RATIO) {
      return [
        `${source}: published food events dropped ${Math.round(drop * 100)}% (${previousPublished} -> ${counts.published}).`,
      ];
    }
  }
  return [];
};
