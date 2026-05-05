// Copyright (C) 2026 by Posit Software, PBC.

import { MockConnectServer } from "./mock-connect-server";

let mockServer: MockConnectServer | null = null;

export async function setup() {
  mockServer = new MockConnectServer();
  await mockServer.start();
  process.env.MOCK_CONNECT_URL = mockServer.url;
  process.env.__CLIENT_TYPE = "typescript";

  console.log(`[setup] Mock Connect server running at ${mockServer.url}`);
  console.log(`[setup] Using TypeScript direct client`);
}

export async function teardown() {
  if (mockServer) {
    await mockServer.stop();
    mockServer = null;
  }

  console.log("[teardown] Servers stopped");
}
