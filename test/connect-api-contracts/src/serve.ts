// Copyright (C) 2026 by Posit Software, PBC.

/**
 * Standalone entry point for the mock Connect server.
 *
 * Usage:
 *   MOCK_CONNECT_PORT=3939 npx tsx src/serve.ts
 *
 * The server binds to 0.0.0.0 so Docker containers can reach it via
 * extra_hosts: host-gateway.
 */

import { MockConnectServer } from "./mock-connect-server";

const port = parseInt(process.env.MOCK_CONNECT_PORT ?? "3939", 10);
const server = new MockConnectServer();

await server.start(port);
console.log(`Mock Connect server listening on ${server.url}`);

process.on("SIGTERM", async () => {
  await server.stop();
  process.exit(0);
});

process.on("SIGINT", async () => {
  await server.stop();
  process.exit(0);
});
