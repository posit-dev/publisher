// Copyright (C) 2026 by Posit Software, PBC.

import { EventSource } from "eventsource";
import {
  cloudLogsBaseUrls,
  type LogsEventData,
  type WatchLogsOptions,
} from "./types.js";

/**
 * Watch Cloud logs via Server-Sent Events.
 *
 * Opens a persistent SSE connection to the Cloud logs endpoint and streams log
 * messages in real-time. Each SSE event contains a batch of log entries that are
 * parsed and forwarded to the `onLog` callback.
 *
 * @param options - Configuration for the log stream
 * @returns Promise that resolves when the stream closes (server-initiated or via signal)
 *
 * @example
 * ```ts
 * const controller = new AbortController();
 * await watchCloudLogs({
 *   environment: CloudEnvironment.Production,
 *   logChannel: "abc123",
 *   authToken: "cloud-token",
 *   onLog: (line) => console.log(`[${line.level}] ${line.message}`),
 *   signal: controller.signal,
 * });
 * ```
 */
export async function watchCloudLogs({
  environment,
  logChannel,
  authToken,
  onLog,
  signal,
}: WatchLogsOptions): Promise<void> {
  // Construct SSE URL with 60-second lookback (matching Go's logLookback)
  const baseUrl = cloudLogsBaseUrls[environment];
  const nowNanos = Date.now() * 1_000_000;
  const lookbackNanos = 60 * 1_000_000_000; // 60 seconds in nanoseconds
  const sortKeyGt = nowNanos - lookbackNanos;
  const url = `${baseUrl}/v1/logs/${logChannel}/stream?sort_key__gt=${sortKeyGt}`;

  return new Promise<void>((resolve, reject) => {
    // Create EventSource with custom fetch to inject Authorization header
    const es = new EventSource(url, {
      fetch: (input, init) =>
        fetch(input, {
          ...init,
          headers: {
            ...init?.headers,
            Authorization: `Bearer ${authToken}`,
          },
        }),
    });

    // Handle abort signal
    if (signal) {
      signal.addEventListener("abort", () => {
        es.close();
        resolve();
      });
    }

    // Handle incoming SSE messages
    es.addEventListener("message", (event) => {
      try {
        const data = JSON.parse(event.data) as LogsEventData;
        // Each event contains an array of log messages
        for (const entry of data.data) {
          onLog({
            level: entry.level,
            message: entry.message,
          });
        }
      } catch {
        // Skip malformed events (don't reject the promise)
        // This matches Go behavior of continuing on parse errors
      }
    });

    // Handle errors and server-initiated closure.
    // When the server closes the SSE stream, the EventSource fires an
    // "error" event with readyState === CLOSED. This is normal — the Go
    // code's WatchLogs resolves without error on stream close. Only reject
    // for genuine connection failures (readyState !== CLOSED).
    es.addEventListener("error", (err) => {
      es.close();
      if (es.readyState === EventSource.CLOSED) {
        resolve();
      } else {
        reject(
          new Error(
            `Cloud logs stream error: ${err.message || "unknown error"}`,
          ),
        );
      }
    });
  });
}
