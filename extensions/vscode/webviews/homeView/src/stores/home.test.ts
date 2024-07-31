import { setActivePinia, createPinia } from "pinia";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { useHomeStore } from "src/stores/home";

vi.mock(import("src/vscode"));

describe("Home Store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  test("initializes with correct defaults", () => {
    const home = useHomeStore();
    expect(home.showDisabledOverlay).toBe(false);
  });
});
