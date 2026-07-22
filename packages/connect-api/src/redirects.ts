// Copyright (C) 2026 by Posit Software, PBC.

import { Readable } from "stream";
import axios from "axios";
import type { AxiosInstance, AxiosRequestConfig } from "axios";

// Custom per-request config fields used by the redirect interceptor.
// Declaration merging keeps this type-safe without `as` casts. Both
// @posit-dev/connect-api and @posit-dev/connect-cloud-api declare identical
// augmentations, which TypeScript merges cleanly.
declare module "axios" {
  export interface AxiosRequestConfig {
    /** Recreates a streamed request body for redirect re-issue. */
    bodyFactory?: () => Readable;
    /** Number of redirect hops already followed for this logical request. */
    redirectCount?: number;
  }
}

/**
 * Statuses we follow, preserving method and body on all of them (libcurl
 * CURLOPT_POSTREDIR semantics, matching posit-sdk-py). 303 is intentionally
 * excluded: Connect never emits it, and following it as GET against e.g. the
 * bundles endpoint would do something surprising — better to fail loudly.
 */
const REDIRECT_STATUSES = new Set([301, 302, 307, 308]);

export const MAX_REDIRECTS = 5;

/**
 * Replicates axios's baseURL + url combination (plain concatenation, not
 * URL resolution) so relative Location headers resolve against the URL the
 * request was actually sent to.
 */
export function resolveRequestUrl(config: AxiosRequestConfig): string {
  const url = config.url ?? "";
  if (/^https?:\/\//i.test(url)) {
    return url;
  }
  const base = (config.baseURL ?? "").replace(/\/+$/, "");
  return url ? `${base}/${url.replace(/^\/+/, "")}` : base;
}

/**
 * Installs manual redirect handling on an axios instance.
 *
 * The instance MUST be created with `maxRedirects: 0` so axios stays on its
 * native http/https transport (which truly streams request bodies); 3xx
 * responses then reject via validateStatus and land in this error handler,
 * which re-issues the request through the same instance. Re-issuing through
 * the instance re-runs the request interceptors, so token-auth signing (which
 * covers the request path) and cookie forwarding stay correct on every hop.
 *
 * Method and body are preserved on 301/302/307/308. Streamed bodies are
 * recreated per hop via `config.bodyFactory` — never buffered, never dropped.
 * Credentials are forwarded wherever Location points (the redirect comes from
 * the user's own configured server), matching rsconnect and posit-sdk-py.
 */
export function attachRedirectHandling(instance: AxiosInstance): void {
  instance.interceptors.response.use(undefined, (error: unknown) => {
    if (!axios.isAxiosError(error) || !error.response || !error.config) {
      return Promise.reject(error);
    }
    const { status, headers } = error.response;
    if (!REDIRECT_STATUSES.has(status)) {
      return Promise.reject(error);
    }
    const location = headers["location"];
    if (typeof location !== "string" || location === "") {
      return Promise.reject(error);
    }

    const config = error.config;
    const redirectCount = (config.redirectCount ?? 0) + 1;
    const currentUrl = resolveRequestUrl(config);
    const target = new URL(location, currentUrl).toString();

    if (redirectCount > MAX_REDIRECTS) {
      return Promise.reject(
        new Error(
          `Too many redirects: gave up after ${MAX_REDIRECTS} while requesting ` +
            `${currentUrl} (next redirect target was ${target})`,
        ),
      );
    }

    // Streamed bodies were consumed (or partially consumed) by the redirected
    // attempt; a stream cannot be replayed, so recreate it from the factory.
    if (config.data instanceof Readable) {
      if (config.bodyFactory === undefined) {
        return Promise.reject(error);
      }
      config.data = config.bodyFactory();
    }

    config.url = target;
    // Location is authoritative for the full target URL, query included;
    // leaving params set would append them a second time.
    config.params = undefined;
    config.redirectCount = redirectCount;
    return instance.request(config);
  });
}
