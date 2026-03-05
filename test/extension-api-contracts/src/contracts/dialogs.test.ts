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

  describe("confirmOK", () => {
    it("calls window.showInformationMessage with modal option and OK item", async () => {
      const result = await dialogs.confirmOK("Are you sure?");
      expect(window.showInformationMessage).toHaveBeenCalledWith(
        "Are you sure?",
        { modal: true },
        { title: "OK" },
      );
      expect(result).toBe(true);
    });

    it("returns false when user cancels", async () => {
      vi.mocked(window.showInformationMessage).mockResolvedValue(undefined);
      const result = await dialogs.confirmOK("Are you sure?");
      expect(result).toBe(false);
    });
  });

  describe("confirmYes", () => {
    it("calls with Yes item", async () => {
      const result = await dialogs.confirmYes("Continue?");
      expect(window.showInformationMessage).toHaveBeenCalledWith(
        "Continue?",
        { modal: true },
        { title: "Yes" },
      );
      expect(result).toBe(true);
    });
  });

  describe("confirmDelete", () => {
    it("calls with Delete item", async () => {
      const result = await dialogs.confirmDelete("Delete this?");
      expect(window.showInformationMessage).toHaveBeenCalledWith(
        "Delete this?",
        { modal: true },
        { title: "Delete" },
      );
      expect(result).toBe(true);
    });
  });

  describe("confirmForget", () => {
    it("calls with Forget item", async () => {
      const result = await dialogs.confirmForget("Forget this?");
      expect(window.showInformationMessage).toHaveBeenCalledWith(
        "Forget this?",
        { modal: true },
        { title: "Forget" },
      );
      expect(result).toBe(true);
    });
  });

  describe("confirmReplace", () => {
    it("calls with Replace item", async () => {
      const result = await dialogs.confirmReplace("Replace existing?");
      expect(window.showInformationMessage).toHaveBeenCalledWith(
        "Replace existing?",
        { modal: true },
        { title: "Replace" },
      );
      expect(result).toBe(true);
    });
  });

  describe("confirmOverwrite", () => {
    it("calls with Overwrite item", async () => {
      const result = await dialogs.confirmOverwrite("Overwrite file?");
      expect(window.showInformationMessage).toHaveBeenCalledWith(
        "Overwrite file?",
        { modal: true },
        { title: "Overwrite" },
      );
      expect(result).toBe(true);
    });
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
