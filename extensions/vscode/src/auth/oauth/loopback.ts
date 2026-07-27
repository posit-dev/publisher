// Copyright (C) 2026 by Posit Software, PBC.

import http from "http";

/** A running loopback redirect listener for the Authorization Code flow. */
export interface LoopbackHandle {
  /** The `http://127.0.0.1:<port>/callback` URI to use as the redirect. */
  redirectUri: string;
  /**
   * Resolves with the authorization `code` once the browser hits the callback
   * with a matching `state`. Rejects on `state` mismatch, an `error` response,
   * a missing code, or timeout.
   */
  waitForCode(): Promise<string>;
  /** Stops the listener and clears the timeout. Safe to call more than once. */
  close(): void;
}

function respondHtml(
  res: http.ServerResponse,
  title: string,
  message: string,
): void {
  const body = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head><body style="font-family: system-ui, sans-serif; text-align: center; padding-top: 4rem;"><h2>${title}</h2><p>${message}</p></body></html>`;
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(body);
}

/**
 * Starts a loopback HTTP server on an ephemeral `127.0.0.1` port to receive the
 * OAuth Authorization Code callback (RFC 8252). Resolves once the socket is
 * bound; rejects if a port can't be bound (the caller then falls back to the
 * device flow).
 *
 * @param expectedState the CSRF `state` the callback must echo back
 * @param timeoutMs how long to wait for the callback before rejecting
 */
export function startLoopbackServer(
  expectedState: string,
  // 600s (10 min) matches rsconnect-python's _CALLBACK_TIMEOUT_SECONDS.
  timeoutMs = 600_000,
): Promise<LoopbackHandle> {
  return new Promise((resolveHandle, rejectHandle) => {
    let resolveCode: (code: string) => void;
    let rejectCode: (err: Error) => void;
    const codePromise = new Promise<string>((res, rej) => {
      resolveCode = res;
      rejectCode = rej;
    });

    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      if (url.pathname !== "/callback") {
        res.writeHead(404);
        res.end("Not found");
        return;
      }

      const error = url.searchParams.get("error");
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");

      if (error) {
        respondHtml(res, "Authentication failed", "You can close this tab.");
        rejectCode(new Error(`Authorization failed: ${error}`));
        return;
      }
      if (state !== expectedState) {
        respondHtml(res, "Authentication failed", "You can close this tab.");
        rejectCode(new Error("Authorization state mismatch (possible CSRF)."));
        return;
      }
      if (!code) {
        respondHtml(res, "Authentication failed", "You can close this tab.");
        rejectCode(new Error("Authorization response was missing a code."));
        return;
      }

      respondHtml(
        res,
        "Authentication complete",
        "You can close this tab and return to your editor.",
      );
      resolveCode(code);
    });

    const timer = setTimeout(() => {
      rejectCode(new Error("Timed out waiting for browser authorization."));
    }, timeoutMs);

    server.once("error", (err) => {
      clearTimeout(timer);
      rejectHandle(err);
    });

    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        clearTimeout(timer);
        server.close();
        rejectHandle(new Error("Could not determine loopback server port."));
        return;
      }
      const { port } = address;
      resolveHandle({
        redirectUri: `http://127.0.0.1:${port}/callback`,
        waitForCode: () => codePromise,
        close: () => {
          clearTimeout(timer);
          server.close();
        },
      });
    });
  });
}
