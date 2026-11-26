import { useEffect, useId, useState, type FormEvent } from "react";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Wait this long after the last keystroke before searching. */
export const SEARCH_DEBOUNCE_MS = 300;

/**
 * A list's search box. It searches as you type (debounced) and leaves the text to the caller,
 * which keeps it in the URL (`?q=`), so back/forward and shared links bring the same results;
 * Enter searches right away.
 */
export function SearchBox({
  label,
  hint,
  value,
  onSearch,
}: {
  label: string;
  hint: string;
  value: string | undefined;
  onSearch: (q: string | undefined) => void;
}) {
  const inputId = useId();
  const hintId = useId();
  const [draft, setDraft] = useState(value ?? "");
  // What this box last put in the URL, to tell our own update from back/forward or a link.
  const [pushed, setPushed] = useState(value);
  const [synced, setSynced] = useState(value);
  if (value !== synced) {
    setSynced(value);
    if (value !== pushed) setDraft(value ?? "");
  }

  const next = draft.trim() || undefined;
  useEffect(() => {
    if (next === value) return;
    const timer = setTimeout(() => {
      setPushed(next);
      onSearch(next);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [next, value, onSearch]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (next === value) return;
    setPushed(next);
    onSearch(next);
  };

  return (
    <form role="search" onSubmit={submit} className="grid w-full gap-1.5 md:max-w-xl">
      <Label htmlFor={inputId}>{label}</Label>
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          id={inputId}
          type="search"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          aria-describedby={hintId}
          autoComplete="off"
          enterKeyHint="search"
          className="pl-11"
        />
      </div>
      <p id={hintId} className="text-small text-muted-foreground">
        {hint}
      </p>
    </form>
  );
}
