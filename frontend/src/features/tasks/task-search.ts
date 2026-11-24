const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The tasks screen's state in the URL, so a view can be bookmarked or shared:
 * `?persona=<user id>` shows that member's tasks ("Por persona"; the user's own without it) and
 * `?hechas=si` adds the done ones.
 */
export interface TaskSearch {
  persona?: string;
  hechas?: "si";
}

/** Keeps only valid values: a hand-edited or stale link falls back to the defaults. */
export function parseTaskSearch(search: Record<string, unknown>): TaskSearch {
  return {
    persona:
      typeof search.persona === "string" && UUID.test(search.persona) ? search.persona : undefined,
    hechas: search.hechas === "si" ? "si" : undefined,
  };
}
