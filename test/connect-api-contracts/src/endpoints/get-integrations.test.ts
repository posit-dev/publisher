// Copyright (C) 2026 by Posit Software, PBC.

import { describe, it, expect } from "vitest";
import { Method } from "../client";
import { setupContractTest } from "../helpers";

describe("GetIntegrations", () => {
  const { client } = setupContractTest();

  describe("request correctness", () => {
    it("sends GET to /__api__/v1/oauth/integrations", async () => {
      const result = await client.call(Method.GetIntegrations);

      expect(result.capturedRequest).not.toBeNull();
      expect(result.capturedRequest!.method).toBe("GET");
      expect(result.capturedRequest!.path).toBe(
        "/__api__/v1/oauth/integrations",
      );
    });
  });

  describe("response parsing", () => {
    it("returns success status", async () => {
      const result = await client.call(Method.GetIntegrations);

      expect(result.status).toBe("success");
    });

    it("parses Integration array with expected fields", async () => {
      const result = await client.call(Method.GetIntegrations);
      const integrations = result.result as Array<{
        guid: string;
        name: string;
        description: string;
        auth_type: string;
        template: string;
        config: Record<string, unknown>;
        created_time: string;
      }>;

      expect(integrations).toBeInstanceOf(Array);
      expect(integrations.length).toBe(1);
      expect(integrations[0].guid).toBe("1a2b3c4d-5e6f-7890-abcd-ef0123456789");
      expect(integrations[0].name).toBe("My OAuth Integration");
      expect(integrations[0].auth_type).toBe("OAuth2");
    });
  });
});
