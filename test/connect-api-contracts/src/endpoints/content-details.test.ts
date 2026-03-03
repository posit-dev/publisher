import { describe, it } from "vitest";

describe.skip("ContentDetails", () => {
  it("sends GET to /__api__/v1/content/:id", () => {
    // Cannot be tested via Go path — no standalone Publisher API endpoint
    // triggers ContentDetails on Connect. Will be tested when the TS
    // ConnectClient is implemented and can be called directly.
  });

  it("sends Authorization header with Key prefix", () => {
    // Stubbed for future TS direct client
  });

  it("parses content fields from response", () => {
    // Stubbed for future TS direct client
  });
});
