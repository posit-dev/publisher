import { MockPublisherServer } from "./mock-publisher-server";

let mockServer: MockPublisherServer | null = null;

export async function setup() {
  mockServer = new MockPublisherServer();
  await mockServer.start();

  process.env.MOCK_PUBLISHER_URL = mockServer.url;

  const backend = process.env.API_BACKEND ?? "axios";
  process.env.__CLIENT_TYPE = backend;

  console.log(`[setup] Mock Publisher server running at ${mockServer.url}`);
  console.log(`[setup] Client type: ${backend}`);
}

export async function teardown() {
  if (mockServer) {
    await mockServer.stop();
    mockServer = null;
  }

  console.log("[teardown] Mock Publisher server stopped");
}
