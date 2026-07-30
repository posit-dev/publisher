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

// Posit Connect wordmark, inlined verbatim from posit-dev/connect
// (ui/images/logoConnect.svg) so the loopback page is fully self-contained and
// renders with no network access. `.cls-1` (wordmark) is recolored for dark mode
// in the page CSS below; `.cls-2` is the blue mark, which reads on both themes.
const CONNECT_LOGO_SVG = `<svg class="logo" role="img" aria-label="Posit Connect" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 301.06 84.05"><defs><style>.cls-1{fill:#404041;}.cls-2{fill:#447099;}</style></defs><path class="cls-1" d="M136.05,49.79c-1.44,2.04-3.42,3.64-5.95,4.79-2.53,1.15-5.29,1.73-8.3,1.73-5.52,0-9.91-1.63-13.17-4.89-3.26-3.26-4.89-7.62-4.89-13.07,0-5.12,1.66-9.39,4.97-12.82,3.31-3.43,7.64-5.14,13-5.14,3.08,0,5.84.56,8.28,1.68,2.44,1.12,4.28,2.58,5.52,4.39l-4.01,3.81c-2.44-2.71-5.6-4.06-9.48-4.06-3.61,0-6.51,1.1-8.68,3.31-2.17,2.21-3.26,5.15-3.26,8.83s1.13,6.58,3.39,8.81c2.26,2.22,5.19,3.34,8.81,3.34,4.25,0,7.66-1.54,10.24-4.62l3.56,3.91Z"/><path class="cls-1" d="M141.27,33.06c2.59-2.56,5.95-3.84,10.06-3.84s7.48,1.28,10.09,3.84c2.61,2.56,3.91,5.81,3.91,9.76s-1.3,7.15-3.91,9.71c-2.61,2.56-5.97,3.84-10.09,3.84s-7.38-1.28-10.01-3.84c-2.63-2.56-3.94-5.8-3.94-9.71s1.3-7.2,3.89-9.76ZM145.53,48.71c1.49,1.56,3.42,2.33,5.8,2.33s4.36-.75,5.85-2.26c1.49-1.51,2.23-3.5,2.23-5.97s-.77-4.47-2.31-6c-1.54-1.52-3.46-2.28-5.77-2.28s-4.27.75-5.77,2.26-2.26,3.51-2.26,6.02c0,2.37.74,4.34,2.23,5.9Z"/><path class="cls-1" d="M169.01,29.82h5.72v2.36c1.97-1.94,4.65-2.91,8.03-2.91,6.99,0,10.49,3.96,10.49,11.89v14.75h-5.72v-14.3c0-2.48-.52-4.26-1.56-5.37-1.04-1.1-2.66-1.66-4.87-1.66-1.4,0-2.68.39-3.81,1.18-1.14.79-1.99,1.86-2.56,3.24v16.91h-5.72v-26.09Z"/><path class="cls-1" d="M198.14,29.82h5.72v2.36c1.97-1.94,4.65-2.91,8.03-2.91,6.99,0,10.49,3.96,10.49,11.89v14.75h-5.72v-14.3c0-2.48-.52-4.26-1.56-5.37-1.04-1.1-2.66-1.66-4.87-1.66-1.4,0-2.68.39-3.81,1.18-1.14.79-1.99,1.86-2.56,3.24v16.91h-5.72v-26.09Z"/><path class="cls-1" d="M249.95,51.05c-2.64,3.55-6.17,5.32-10.59,5.32s-7.6-1.23-10.16-3.69-3.84-5.75-3.84-9.86,1.18-7.24,3.54-9.78c2.36-2.54,5.64-3.81,9.86-3.81,3.55,0,6.47,1.1,8.78,3.29,2.31,2.19,3.46,5.08,3.46,8.66,0,.87-.1,2.09-.3,3.66h-19.37c.23,2.01,1.09,3.55,2.56,4.62,1.47,1.07,3.33,1.61,5.57,1.61,2.94,0,5.27-1.15,6.97-3.46l3.51,3.46ZM233.8,35.84c-1.24.97-2.04,2.31-2.41,4.01h13.7c-.23-1.77-.92-3.13-2.06-4.06s-2.64-1.4-4.52-1.4-3.48.49-4.72,1.45Z"/><path class="cls-1" d="M279.12,49.94c-1.04,2.04-2.58,3.62-4.62,4.74-2.04,1.12-4.23,1.68-6.57,1.68-4.22,0-7.61-1.24-10.19-3.71-2.58-2.48-3.86-5.75-3.86-9.83s1.27-7.16,3.81-9.73c2.54-2.58,5.85-3.86,9.93-3.86,2.61,0,4.91.54,6.9,1.63,1.99,1.09,3.42,2.52,4.29,4.29l-4.27,2.81c-1.71-2.27-3.93-3.41-6.67-3.41-2.37,0-4.32.77-5.82,2.31-1.51,1.54-2.26,3.53-2.26,5.97s.79,4.34,2.38,5.9,3.69,2.33,6.3,2.33c2.74,0,4.93-1.24,6.57-3.71l4.06,2.61Z"/><path class="cls-1" d="M280.34,29.82h4.52v-5.37h5.72v5.37h8.43v5.32h-8.43v10.08c0,2.07.26,3.54.78,4.39.52.85,1.38,1.28,2.58,1.28,1.34,0,2.58-.74,3.71-2.21l3.41,3.21c-.74,1.27-1.81,2.31-3.24,3.11-1.42.8-3,1.2-4.74,1.2-2.54,0-4.55-.8-6.02-2.41-1.47-1.61-2.21-3.93-2.21-6.97v-11.69h-4.52v-5.32Z"/><rect class="cls-2" x="37.94" y="22.72" width="38.34" height="38.34" rx="2.17" ry="2.17" transform="translate(-12.89 52.65) rotate(-45)"/><path class="cls-2" d="M15.67,43.36c-.74-.74-.74-1.94,0-2.68L49.31,7.05l-6.5-6.5c-.74-.74-1.94-.74-2.68,0L0,40.69c-.74.74-.74,1.94,0,2.68l40.13,40.13c.74.74,1.94.74,2.68,0l6.5-6.5L15.67,43.36Z"/></svg>`;

type PageVariant = "success" | "error";

const STATUS_ICONS: Record<PageVariant, string> = {
  success: `<svg class="status" viewBox="0 0 56 56" role="img" aria-label="Success"><circle cx="28" cy="28" r="28" fill="#1a7f37"/><path d="M17 29l7.5 7.5L39 21" fill="none" stroke="#fff" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  error: `<svg class="status" viewBox="0 0 56 56" role="img" aria-label="Failed"><circle cx="28" cy="28" r="28" fill="#cf222e"/><path d="M19 19l18 18M37 19L19 37" fill="none" stroke="#fff" stroke-width="4.5" stroke-linecap="round"/></svg>`,
};

/**
 * Renders the self-contained HTML page shown in the user's browser after the
 * OAuth redirect (success or error). Exported for testing/preview.
 */
export function renderPage(
  variant: PageVariant,
  title: string,
  message: string,
): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
:root { color-scheme: light dark; }
* { box-sizing: border-box; }
body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  background: #f5f6f8; color: #1f2328; padding: 24px; }
.card { width: min(92vw, 440px); background: #fff; border: 1px solid rgba(0,0,0,.06);
  border-radius: 14px; padding: 40px 40px 34px; text-align: center;
  box-shadow: 0 1px 2px rgba(0,0,0,.06), 0 14px 34px rgba(0,0,0,.10); }
.logo { display: block; width: 184px; height: auto; margin: 0 auto 24px; }
.status { display: block; width: 56px; height: 56px; margin: 0 auto 18px; }
h1 { font-size: 20px; font-weight: 600; margin: 0 0 8px; letter-spacing: -.01em; }
p { font-size: 14px; line-height: 1.55; margin: 0; color: #57606a; }
@media (prefers-color-scheme: dark) {
  body { background: #1e1e1e; color: #e6edf3; }
  .card { background: #252526; border-color: rgba(255,255,255,.08);
    box-shadow: 0 1px 2px rgba(0,0,0,.4), 0 14px 34px rgba(0,0,0,.55); }
  p { color: #9aa4af; }
  .logo .cls-1 { fill: #e6edf3; }
}
</style>
</head>
<body>
<main class="card">
${CONNECT_LOGO_SVG}
${STATUS_ICONS[variant]}
<h1>${title}</h1>
<p>${message}</p>
</main>
</body>
</html>`;
}

function respondHtml(
  res: http.ServerResponse,
  variant: PageVariant,
  title: string,
  message: string,
): void {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(renderPage(variant, title, message));
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

      const failureMessage =
        "Something went wrong signing in. You can close this tab and try again from your editor.";
      if (error) {
        respondHtml(res, "error", "Authentication failed", failureMessage);
        rejectCode(new Error(`Authorization failed: ${error}`));
        return;
      }
      if (state !== expectedState) {
        respondHtml(res, "error", "Authentication failed", failureMessage);
        rejectCode(new Error("Authorization state mismatch (possible CSRF)."));
        return;
      }
      if (!code) {
        respondHtml(res, "error", "Authentication failed", failureMessage);
        rejectCode(new Error("Authorization response was missing a code."));
        return;
      }

      respondHtml(
        res,
        "success",
        "Authentication complete",
        "You're signed in to Posit Connect. You can close this tab and return to your editor.",
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
