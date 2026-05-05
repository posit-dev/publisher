// Copyright (C) 2026 by Posit Software, PBC.

/**
 * Standalone entry point for the mock Connect server.
 *
 * Usage:
 *   MOCK_CONNECT_PORT=3939 npx tsx src/serve.ts
 *
 * The server binds to 0.0.0.0 by default so Docker containers can reach it
 * via extra_hosts: host-gateway.
 */

import { MockConnectServer } from "./mock-connect-server.js";

const port = parseInt(process.env.MOCK_CONNECT_PORT ?? "3939", 10);
if (isNaN(port)) {
  throw new Error(
    `Invalid MOCK_CONNECT_PORT: "${process.env.MOCK_CONNECT_PORT}" is not a number`,
  );
}
const host = process.env.MOCK_CONNECT_HOST ?? "0.0.0.0";
const server = new MockConnectServer();

await server.start({ port, host });
console.log(`Mock Connect server listening on ${server.url}`);

process.on("SIGTERM", async () => {
  await server.stop();
  process.exit(0);
});

process.on("SIGINT", async () => {
  await server.stop();
  process.exit(0);
});
