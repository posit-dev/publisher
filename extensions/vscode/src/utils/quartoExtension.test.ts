// Copyright (C) 2026 by Posit Software, PBC.

import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("vscode", () => ({
  extensions: {
    getExtension: vi.fn(),
  },
}));

import { extensions } from "vscode";
import { getQuartoExtensionBinDir } from "./quartoExtension";

type Ext = ReturnType<typeof extensions.getExtension>;

afterEach(() => {
  vi.clearAllMocks();
});

describe("getQuartoExtensionBinDir", () => {
  test("returns undefined when the Quarto extension isn't installed", async () => {
    vi.mocked(extensions.getExtension).mockReturnValue(undefined);

    expect(await getQuartoExtensionBinDir()).toBeUndefined();
    expect(extensions.getExtension).toHaveBeenCalledWith("quarto.quarto");
  });

  test("uses the exports of an already-active extension", async () => {
    const activate = vi.fn();
    vi.mocked(extensions.getExtension).mockReturnValue({
      isActive: true,
      exports: { getQuartoPath: () => "/opt/quarto/bin" },
      activate,
    } as unknown as Ext);

    expect(await getQuartoExtensionBinDir()).toBe("/opt/quarto/bin");
    expect(activate).not.toHaveBeenCalled();
  });

  test("activates the extension when it isn't active yet", async () => {
    vi.mocked(extensions.getExtension).mockReturnValue({
      isActive: false,
      exports: undefined,
      activate: () => Promise.resolve({ getQuartoPath: () => "/q/bin" }),
    } as unknown as Ext);

    expect(await getQuartoExtensionBinDir()).toBe("/q/bin");
  });

  test("returns undefined when the extension found no Quarto", async () => {
    vi.mocked(extensions.getExtension).mockReturnValue({
      isActive: true,
      exports: { getQuartoPath: () => undefined },
    } as unknown as Ext);

    expect(await getQuartoExtensionBinDir()).toBeUndefined();
  });

  test("tolerates an older extension without getQuartoPath", async () => {
    vi.mocked(extensions.getExtension).mockReturnValue({
      isActive: true,
      exports: undefined,
    } as unknown as Ext);

    expect(await getQuartoExtensionBinDir()).toBeUndefined();
  });
});
