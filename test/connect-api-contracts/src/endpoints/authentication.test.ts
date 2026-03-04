import { describe, it, expect } from "vitest";
import { setupContractTest, setMockResponse } from "../helpers";

describe("TestAuthentication", () => {
  const { client, apiKey } = setupContractTest();

  describe("request correctness", () => {
    it("sends GET to /__api__/v1/user", async () => {
      const result = await client.call("TestAuthentication");

      expect(result.capturedRequest).not.toBeNull();
      expect(result.capturedRequest!.method).toBe("GET");
      expect(result.capturedRequest!.path).toBe("/__api__/v1/user");
    });

    it("sends Authorization header with Key prefix", async () => {
      const result = await client.call("TestAuthentication");

      expect(result.capturedRequest).not.toBeNull();
      expect(result.capturedRequest!.headers["authorization"]).toBe(
        `Key ${apiKey}`,
      );
    });
  });

  describe("response parsing", () => {
    it("returns success status", async () => {
      const result = await client.call("TestAuthentication");

      expect(result.status).toBe("success");
    });

    it("parses user fields from Connect UserDTO", async () => {
      const result = await client.call("TestAuthentication");
      const body = result.result as {
        user: {
          id: string;
          username: string;
          first_name: string;
          last_name: string;
          email: string;
        };
      };

      // Publisher maps Connect's UserDTO (12 fields) down to User (5 fields)
      expect(body.user).toEqual({
        id: "40d1c1dc-d554-4905-99f1-359517e1a7c0",
        username: "bob",
        first_name: "Bob",
        last_name: "Bobberson",
        email: "bob@example.com",
      });
    });

    it("returns null error on success", async () => {
      const result = await client.call("TestAuthentication");
      const body = result.result as { error: unknown };

      expect(body.error).toBeNull();
    });
  });

  describe("error handling", () => {
    it("returns error for 401 unauthorized response", async () => {
      await setMockResponse({
        method: "GET",
        pathPattern: "^/__api__/v1/user$",
        status: 401,
        body: { code: 3, error: "Key is not valid" },
      });

      const result = await client.call("TestAuthentication");
      const body = result.result as {
        user: unknown;
        error: { msg: string } | null;
      };

      expect(result.status).toBe("error");
      expect(body.error).not.toBeNull();
      expect(body.user).toBeNull();
    });

    it("returns error for locked user account", async () => {
      await setMockResponse({
        method: "GET",
        pathPattern: "^/__api__/v1/user$",
        status: 200,
        body: {
          email: "bob@example.com",
          username: "bob",
          first_name: "Bob",
          last_name: "Bobberson",
          user_role: "publisher",
          created_time: "2023-01-01T00:00:00Z",
          updated_time: "2023-01-01T00:00:00Z",
          active_time: null,
          confirmed: true,
          locked: true,
          guid: "40d1c1dc-d554-4905-99f1-359517e1a7c0",
        },
      });

      const result = await client.call("TestAuthentication");
      const body = result.result as {
        user: unknown;
        error: { msg: string } | null;
      };

      expect(result.status).toBe("error");
      expect(body.error).not.toBeNull();
      expect(body.error!.msg.toLowerCase()).toContain("locked");
      expect(body.user).toBeNull();
    });

    it("returns error for unconfirmed user account", async () => {
      await setMockResponse({
        method: "GET",
        pathPattern: "^/__api__/v1/user$",
        status: 200,
        body: {
          email: "bob@example.com",
          username: "bob",
          first_name: "Bob",
          last_name: "Bobberson",
          user_role: "publisher",
          created_time: "2023-01-01T00:00:00Z",
          updated_time: "2023-01-01T00:00:00Z",
          active_time: null,
          confirmed: false,
          locked: false,
          guid: "40d1c1dc-d554-4905-99f1-359517e1a7c0",
        },
      });

      const result = await client.call("TestAuthentication");
      const body = result.result as {
        user: unknown;
        error: { msg: string } | null;
      };

      expect(result.status).toBe("error");
      expect(body.error).not.toBeNull();
      expect(body.error!.msg.toLowerCase()).toContain("not confirmed");
      expect(body.user).toBeNull();
    });

    it("returns error for viewer role user", async () => {
      await setMockResponse({
        method: "GET",
        pathPattern: "^/__api__/v1/user$",
        status: 200,
        body: {
          email: "bob@example.com",
          username: "bob",
          first_name: "Bob",
          last_name: "Bobberson",
          user_role: "viewer",
          created_time: "2023-01-01T00:00:00Z",
          updated_time: "2023-01-01T00:00:00Z",
          active_time: null,
          confirmed: true,
          locked: false,
          guid: "40d1c1dc-d554-4905-99f1-359517e1a7c0",
        },
      });

      const result = await client.call("TestAuthentication");
      const body = result.result as {
        user: unknown;
        error: { msg: string } | null;
      };

      expect(result.status).toBe("error");
      expect(body.error).not.toBeNull();
      expect(body.error!.msg.toLowerCase()).toContain("permission");
      expect(body.user).toBeNull();
    });
  });

  describe("snapshot", () => {
    it("matches expected response shape", async () => {
      const result = await client.call("TestAuthentication");

      expect(result.result).toMatchInlineSnapshot(`
        {
          "error": null,
          "user": {
            "email": "bob@example.com",
            "first_name": "Bob",
            "id": "40d1c1dc-d554-4905-99f1-359517e1a7c0",
            "last_name": "Bobberson",
            "username": "bob",
          },
        }
      `);
    });
  });
});
