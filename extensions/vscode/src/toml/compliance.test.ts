// Copyright (C) 2026 by Posit Software, PBC.

import { describe, expect, it } from "vitest";
import { forceProductTypeCompliance } from "./compliance";
import { ConfigurationDetails, ContentType } from "../api/types/configurations";
import { ProductType } from "../api/types/contentRecords";

function makeConfig(
  overrides: Partial<ConfigurationDetails> = {},
): ConfigurationDetails {
  return {
    $schema:
      "https://cdn.posit.co/publisher/schemas/posit-publishing-schema-v3.json",
    type: ContentType.PYTHON_DASH,
    productType: ProductType.CONNECT,
    validate: true,
    ...overrides,
  };
}

describe("forceProductTypeCompliance", () => {
  describe("Connect Cloud", () => {
    it("clears disallowed Python fields", () => {
      const config = makeConfig({
        productType: ProductType.CONNECT_CLOUD,
        python: {
          version: "3.11.3",
          packageFile: "requirements.txt",
          packageManager: "pip",
          requiresPython: ">=3.11",
        },
      });

      forceProductTypeCompliance(config);

      expect(config.python?.version).toBe("3.11");
      expect(config.python?.packageFile).toBe("");
      expect(config.python?.packageManager).toBe("");
      expect(config.python?.requiresPython).toBeUndefined();
    });

    it("clears disallowed R fields", () => {
      const config = makeConfig({
        productType: ProductType.CONNECT_CLOUD,
        type: ContentType.R_SHINY,
        r: {
          version: "4.3.1",
          packageFile: "renv.lock",
          packageManager: "renv",
          requiresR: ">=4.3",
          packagesFromLibrary: false,
        },
      });

      forceProductTypeCompliance(config);

      expect(config.r?.version).toBe("4.3.1");
      expect(config.r?.packageFile).toBe("");
      expect(config.r?.packageManager).toBe("");
      expect(config.r?.requiresR).toBeUndefined();
      expect(config.r?.packagesFromLibrary).toBeUndefined();
    });

    it("truncates Python version to X.Y format", () => {
      const config = makeConfig({
        productType: ProductType.CONNECT_CLOUD,
        python: {
          version: "3.11.7",
          packageFile: "",
          packageManager: "",
        },
      });

      forceProductTypeCompliance(config);

      expect(config.python?.version).toBe("3.11");
    });

    it("leaves Python version alone if already X.Y", () => {
      const config = makeConfig({
        productType: ProductType.CONNECT_CLOUD,
        python: {
          version: "3.11",
          packageFile: "",
          packageManager: "",
        },
      });

      forceProductTypeCompliance(config);

      expect(config.python?.version).toBe("3.11");
    });

    it("leaves single-segment Python version alone", () => {
      const config = makeConfig({
        productType: ProductType.CONNECT_CLOUD,
        python: {
          version: "3",
          packageFile: "",
          packageManager: "",
        },
      });

      forceProductTypeCompliance(config);

      expect(config.python?.version).toBe("3");
    });

    it("clears quarto, jupyter, and hasParameters", () => {
      const config = makeConfig({
        productType: ProductType.CONNECT_CLOUD,
        type: ContentType.QUARTO_STATIC,
        quarto: { version: "1.4" },
        jupyter: { hideAllInput: true },
        hasParameters: true,
      });

      forceProductTypeCompliance(config);

      expect(config.quarto).toBeUndefined();
      expect(config.jupyter).toBeUndefined();
      expect(config.hasParameters).toBeUndefined();
    });

    it("handles missing optional sections gracefully", () => {
      const config = makeConfig({
        productType: ProductType.CONNECT_CLOUD,
      });

      // Should not throw
      forceProductTypeCompliance(config);
    });
  });

  describe("Connect", () => {
    it("does not strip Python fields", () => {
      const config = makeConfig({
        productType: ProductType.CONNECT,
        python: {
          version: "3.11.3",
          packageFile: "requirements.txt",
          packageManager: "pip",
          requiresPython: ">=3.11",
        },
      });

      forceProductTypeCompliance(config);

      expect(config.python?.version).toBe("3.11.3");
      expect(config.python?.packageFile).toBe("requirements.txt");
      expect(config.python?.packageManager).toBe("pip");
      expect(config.python?.requiresPython).toBe(">=3.11");
    });

    it("preserves quarto, jupyter, and hasParameters", () => {
      const config = makeConfig({
        productType: ProductType.CONNECT,
        quarto: { version: "1.4" },
        jupyter: { hideAllInput: true },
        hasParameters: true,
      });

      forceProductTypeCompliance(config);

      expect(config.quarto).toEqual({ version: "1.4" });
      expect(config.jupyter).toEqual({ hideAllInput: true });
      expect(config.hasParameters).toBe(true);
    });
  });

  describe("always", () => {
    it("clears alternatives", () => {
      const config = makeConfig({
        alternatives: [makeConfig({ type: ContentType.HTML })],
      });

      forceProductTypeCompliance(config);

      expect(config.alternatives).toBeUndefined();
    });
  });
});
