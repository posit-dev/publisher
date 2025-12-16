// Copyright (C) 2025 by Posit Software, PBC.

import { describe, expect, test, vi } from "vitest";
import { ProductType, ProductName } from "src/api";

// Mock vscode module since it's not available in test environment
vi.mock("vscode", () => ({
  InputBoxValidationSeverity: {
    Error: 3,
    Warning: 2,
    Info: 1,
  },
  window: {},
}));

// Import after mocking vscode
const { validateGuidInput } = await import("src/actions/showAssociateGUID");

describe("showAssociateGUID validation logic", () => {
  const sampleGuid = "adffa505-08c7-450f-88d0-f42957f56eff";
  const connectCloudAccountName = "my-account";

  describe("Posit Connect validation", () => {
    const productType = ProductType.CONNECT;
    const productName = ProductName.CONNECT;

    describe("currently accepted inputs (should remain valid)", () => {
      test("accepts Connect in-app URL", () => {
        const url = `https://connect.company.co/connect/#/apps/${sampleGuid}`;
        const result = validateGuidInput(url, productType, productName);
        expect(result).toBeNull();
      });

      test("accepts Connect in-app URL with deep path", () => {
        const url = `https://company.co/data-science/2025/staging/#/apps/${sampleGuid}`;
        const result = validateGuidInput(url, productType, productName);
        expect(result).toBeNull();
      });

      test("accepts Connect in-app URL with subdomain", () => {
        const url = `https://connect.my_sub.company.com/connect/#/apps/${sampleGuid}`;
        const result = validateGuidInput(url, productType, productName);
        expect(result).toBeNull();
      });
    });

    describe("onprem Connect is liberal in what it accepts with GUIDs", () => {
      test("accepts Connect standalone URL", () => {
        const url = `https://connect.company.co/content/${sampleGuid}`;
        const result = validateGuidInput(url, productType, productName);

        expect(result).toBeNull();
      });

      test("without trailing slash", () => {
        const url = `https://connect.company.co/content/${sampleGuid}/`;
        const result = validateGuidInput(url, productType, productName);

        expect(result).toBeNull();
      });

      test("plain GUID", () => {
        const guid = sampleGuid;
        const result = validateGuidInput(guid, productType, productName);

        expect(result).toBeNull();
      });

      test("GUID with braces", () => {
        const guid = `{${sampleGuid}}`;
        const result = validateGuidInput(guid, productType, productName);

        expect(result).toBeNull();
      });
    });

    describe("invalid inputs (should remain rejected)", () => {
      test("rejects URL without GUID", () => {
        const url = "https://connect.company.co/connect/#/apps/";
        const result = validateGuidInput(url, productType, productName);
        expect(result).not.toBeNull();
        expect(result?.message).toContain("content GUID");
      });

      test("rejects empty string", () => {
        const result = validateGuidInput("", productType, productName);
        expect(result).not.toBeNull();
        expect(result?.message).toContain("content GUID");
      });

      test("rejects random text without GUID", () => {
        const result = validateGuidInput(
          "just some random text",
          productType,
          productName,
        );
        expect(result).not.toBeNull();
        expect(result?.message).toContain("content GUID");
      });

      test("rejects malformed GUID", () => {
        const result = validateGuidInput(
          "adffa505-08c7-450f-88d0-f42957f56ef",
          productType,
          productName,
        );
        expect(result).not.toBeNull();
        expect(result?.message).toContain("content GUID");
      });
    });
  });

  describe("Connect Cloud validation", () => {
    const productType = ProductType.CONNECT_CLOUD;
    const productName = ProductName.CONNECT_CLOUD;

    describe("currently accepted inputs (should remain valid)", () => {
      test("accepts Connect Cloud URL with correct account", () => {
        const url = `https://connect.posit.cloud/${connectCloudAccountName}/content/${sampleGuid}`;
        const result = validateGuidInput(
          url,
          productType,
          productName,
          connectCloudAccountName,
        );
        expect(result).toBeNull();
      });

      test("accepts Connect Cloud URL with different account format", () => {
        const accountName = "user-profile-123";
        const url = `https://connect.posit.cloud/${accountName}/content/${sampleGuid}`;
        const result = validateGuidInput(
          url,
          productType,
          productName,
          accountName,
        );
        expect(result).toBeNull();
      });
    });

    describe("invalid inputs are rejected", () => {
      test("rejects plain GUID (should accept)", () => {
        const guid = sampleGuid;
        const result = validateGuidInput(
          guid,
          productType,
          productName,
          connectCloudAccountName,
        );

        expect(result).not.toBeNull();
        expect(result?.message).toContain("Unexpected URL format");
      });

      test("rejects URL with wrong account", () => {
        const url = `https://connect.posit.cloud/different-account/content/${sampleGuid}`;
        const result = validateGuidInput(
          url,
          productType,
          productName,
          connectCloudAccountName,
        );
        expect(result).not.toBeNull();
        expect(result?.message).toContain("Account mismatch");
      });

      test("rejects URL without GUID", () => {
        const url = `https://connect.posit.cloud/${connectCloudAccountName}/content/`;
        const result = validateGuidInput(
          url,
          productType,
          productName,
          connectCloudAccountName,
        );
        expect(result).not.toBeNull();
        expect(result?.message).toContain("content GUID");
      });

      test("rejects empty string", () => {
        const result = validateGuidInput(
          "",
          productType,
          productName,
          connectCloudAccountName,
        );
        expect(result).not.toBeNull();
        expect(result?.message).toContain("content GUID");
      });

      test("rejects random text without GUID", () => {
        const result = validateGuidInput(
          "just some random text",
          productType,
          productName,
          connectCloudAccountName,
        );
        expect(result).not.toBeNull();
        expect(result?.message).toContain("content GUID");
      });
    });
  });
});
