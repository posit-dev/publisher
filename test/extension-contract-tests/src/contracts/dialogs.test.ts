// Copyright (C) 2026 by Posit Software, PBC.

// Contract: dialogs.ts → window.showInformationMessage (modal), l10n.t

import { describe, it, expect, beforeEach, vi } from "vitest";
import { window, l10n } from "vscode";

// Capture l10n.t call history at module load time (before clearAllMocks)
const l10nCallsAtLoad = [...((l10n.t as any).mock?.calls ?? [])];

// Import after vscode mock is in place
const dialogs = await import("src/dialogs");

// Record l10n.t calls that happened during module load
const l10nCallsAfterImport = [...((l10n.t as any).mock?.calls ?? [])];

describe("dialogs contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock showInformationMessage to return the affirmativeItem argument
    // (the third positional arg). The confirm() function uses === reference
    // equality, so we must return the exact same object reference.
    vi.mocked(window.showInformationMessage).mockImplementation(
      (...args: any[]) => {
        // args: [message, options, item?] or [message, options]
        // Return the last argument if it's an item (has 'title')
        const lastArg = args[args.length - 1];
        if (lastArg && typeof lastArg === "object" && "title" in lastArg) {
          return Promise.resolve(lastArg);
        }
        return Promise.resolve(undefined);
      },
    );
  });

  describe("l10n.t usage for button labels", () => {
    it("uses l10n.t to localize button titles", () => {
      // dialogs.ts calls l10n.t at module level for all items.
      // Check the calls that were captured during module import.
      const calledArgs = l10nCallsAfterImport.map((c) => c[0]);
      expect(calledArgs).toContain("OK");
      expect(calledArgs).toContain("Delete");
      expect(calledArgs).toContain("Forget");
      expect(calledArgs).toContain("Overwrite");
      expect(calledArgs).toContain("Replace");
      expect(calledArgs).toContain("Yes");
    });
  });

  it.each([
    ["confirmOK", "OK"],
    ["confirmYes", "Yes"],
    ["confirmDelete", "Delete"],
    ["confirmForget", "Forget"],
    ["confirmReplace", "Replace"],
    ["confirmOverwrite", "Overwrite"],
  ] as const)(
    "%s calls showInformationMessage with modal option and %s item",
    async (fnName, title) => {
      const fn = dialogs[fnName] as (msg: string) => Promise<boolean>;
      const result = await fn("Test message");
      expect(window.showInformationMessage).toHaveBeenCalledWith(
        "Test message",
        { modal: true },
        { title },
      );
      expect(result).toBe(true);
    },
  );

  it("returns false when user cancels a confirm dialog", async () => {
    vi.mocked(window.showInformationMessage).mockResolvedValue(undefined);
    const result = await dialogs.confirmOK("Are you sure?");
    expect(result).toBe(false);
  });

  describe("alert", () => {
    it("calls window.showInformationMessage with modal option only", async () => {
      vi.mocked(window.showInformationMessage).mockResolvedValue(undefined);
      await dialogs.alert("Something happened");
      expect(window.showInformationMessage).toHaveBeenCalledWith(
        "Something happened",
        { modal: true },
      );
    });
  });
});
