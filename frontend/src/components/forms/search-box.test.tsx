import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SEARCH_DEBOUNCE_MS, SearchBox } from "@/components/forms/search-box";

function renderBox(value: string | undefined, onSearch = vi.fn()) {
  const view = render(
    <SearchBox label="Buscá" hint="Por nombre." value={value} onSearch={onSearch} />,
  );
  return { ...view, onSearch, input: screen.getByRole("searchbox", { name: "Buscá" }) };
}

describe("SearchBox", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("searches the trimmed text once typing stops", () => {
    const { input, onSearch } = renderBox(undefined);

    fireEvent.change(input, { target: { value: "  Ficticio " } });
    act(() => vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 1));
    expect(onSearch).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));

    expect(onSearch).toHaveBeenCalledExactlyOnceWith("Ficticio");
    expect(input).toHaveAccessibleDescription("Por nombre.");
  });

  it("searches right away on Enter, and clears with an empty box", () => {
    const { input, onSearch } = renderBox("Ficticio");

    fireEvent.change(input, { target: { value: "Muestra" } });
    fireEvent.submit(input.closest("form")!);
    expect(onSearch).toHaveBeenCalledExactlyOnceWith("Muestra");

    fireEvent.change(input, { target: { value: "   " } });
    act(() => vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS));
    expect(onSearch).toHaveBeenLastCalledWith(undefined);
  });

  it("follows a value that changes from outside (back/forward, a link)", () => {
    const { input, rerender, onSearch } = renderBox("Ficticio");
    expect(input).toHaveValue("Ficticio");

    rerender(<SearchBox label="Buscá" hint="Por nombre." value="Ejemplo" onSearch={onSearch} />);

    expect(input).toHaveValue("Ejemplo");
    act(() => vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS));
    expect(onSearch).not.toHaveBeenCalled();
  });
});
