import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// jsdom does not implement scrolling; TanStack Router restores scroll on navigation.
window.scrollTo = () => {};

afterEach(() => {
  cleanup();
});
