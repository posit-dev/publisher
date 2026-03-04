import { describe, it, expect } from "vitest";
import { setupContractTest } from "../helpers";

describe("GetCurrentUser", () => {
  const { client } = setupContractTest();

  describe("request correctness", () => {
    it("sends GET to /__api__/v1/user", async () => {
      const result = await client.call("GetCurrentUser");

      expect(result.capturedRequest).not.toBeNull();
      expect(result.capturedRequest!.method).toBe("GET");
      expect(result.capturedRequest!.path).toBe("/__api__/v1/user");
    });
  });

  describe("response parsing", () => {
    it("returns success status", async () => {
      const result = await client.call("GetCurrentUser");

      expect(result.status).toBe("success");
    });

    it("parses User fields from Connect UserDTO", async () => {
      const result = await client.call("GetCurrentUser");
      const user = result.result as {
        id: string;
        username: string;
        first_name: string;
        last_name: string;
        email: string;
      };

      expect(user).toEqual({
        id: "40d1c1dc-d554-4905-99f1-359517e1a7c0",
        username: "bob",
        first_name: "Bob",
        last_name: "Bobberson",
        email: "bob@example.com",
      });
    });
  });
});
