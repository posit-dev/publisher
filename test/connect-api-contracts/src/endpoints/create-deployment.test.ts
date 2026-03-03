import { describe, it } from "vitest";

describe.skip("CreateDeployment", () => {
  it("sends POST to /__api__/v1/content", () => {
    // Cannot be tested via Go path — no standalone Publisher API endpoint
    // triggers CreateDeployment on Connect. Will be tested when the TS
    // ConnectClient is implemented and can be called directly.
  });

  it("sends Authorization header with Key prefix", () => {
    // Stubbed for future TS direct client
  });

  it("parses content GUID from response", () => {
    // Stubbed for future TS direct client
  });
});
