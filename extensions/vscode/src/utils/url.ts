// Copyright (C) 2025 by Posit Software, PBC.

import config from "../../src/config";
import { extractGUID } from "./guid";

export const formatURL = (input: string): string => {
  // check if the URL starts with a scheme
  if (/^[a-zA-Z]+:\/\//.test(input)) {
    return input;
  }
  return `https://${input}`;
};

// Currently just adds a trailing slash
export const normalizeURL = (input: string): string => {
  let result = input;
  if (!result.endsWith("/")) {
    result += "/";
  }
  return result;
};

const isMatchingURL = (input: string, regex: RegExp) => {
  const guid = extractGUID(input)?.at(0);
  const guidlessInput = guid ? (input.split(guid)[0] ?? "") : "";
  return regex.test(guidlessInput);
};

// All the following inputs will return "true" (production environment):
//   "https://connect.posit.cloud/my-account/content/adffa505-08c7-450f-88d0-f42957f56eff"
//   "https://connect.posit.cloud/user-profile-123/content/adffa505-08c7-450f-88d0-f42957f56eff"
//   "https://connect.posit.cloud/slug123/content/adffa505-08c7-450f-88d0-f42957f56eff"
// All the following inputs will return "false":
//   "https://connect.posit.cloud/slug_with_underscore/content/adffa505-08c7-450f-88d0-f42957f56eff" // underscores
//   "https://connect.posit.cloud/my account/content/adffa505-08c7-450f-88d0-f42957f56eff" // space
//   "https://connect.posit.cloud/my-account/folder/content/adffa505-08c7-450f-88d0-f42957f56eff" // extra path segment
export const isConnectCloudContentURL = (input: string) => {
  const regex = new RegExp(
    `^${config.connectCloudURL}/[a-zA-Z0-9-]+/content/$`,
  );
  return isMatchingURL(input, regex);
};

/**
 * Normalize a server URL: lowercase host, remove default port,
 * remove trailing slash, deduplicate slashes, resolve dot segments.
 * Strips query and fragment. Throws on invalid URL.
 */
export function normalizeServerURL(serverUrl: string): string {
  const u = new URL(serverUrl);
  // URL constructor auto-lowercases host and removes default ports.
  // Normalize path: remove duplicate slashes, resolve dots, remove trailing slash.
  const path = u.pathname.replace(/\/+/g, "/").replace(/\/$/, "");
  u.pathname = path;
  // Return origin + pathname (strip query/fragment)
  const result = u.origin + u.pathname;
  return result === u.origin + "/" ? u.origin : result;
}

/**
 * Given a server URL, produce a list of progressively longer path-segment URLs
 * (from base domain to full path), stripping query/fragment.
 * Throws on invalid URL.
 */
export function getListOfPossibleUrls(serverUrl: string): string[] {
  const normalized = normalizeServerURL(serverUrl);
  const u = new URL(normalized);
  const origin = u.origin;
  const segments = u.pathname.split("/").filter(Boolean);

  const urls = [origin];
  let current = "";
  for (const seg of segments) {
    current += "/" + seg;
    urls.push(origin + current);
  }
  return urls;
}

/** A function that tests a URL by making an HTTP call; throws on failure. */
export type UrlTester = (url: string) => Promise<void>;

/**
 * Walk possible URLs in reverse order (longest path first), call the tester
 * on each, and return the first that succeeds. Throws the last tester error
 * if all URLs fail. If the URL is invalid, the error from getListOfPossibleUrls
 * propagates.
 */
export async function discoverServerUrl(
  providedUrl: string,
  tester: UrlTester,
): Promise<string> {
  const possibleUrls = getListOfPossibleUrls(providedUrl);

  let lastError: unknown;
  // Walk backwards — prefer full path over stripped versions
  for (let i = possibleUrls.length - 1; i >= 0; i--) {
    try {
      await tester(possibleUrls[i]);
      return possibleUrls[i];
    } catch (err) {
      lastError = err;
    }
  }

  // All URLs failed — throw the last error
  throw lastError;
}

export const extractConnectCloudAccount = (input: string) => {
  // sample URL: "https://connect.posit.cloud/my-account/content/adffa505-08c7-450f-88d0-f42957f56eff"
  const url = new URL(input);

  // the pathname is the part of the URL after the domain, e.g., "/my-account/content/adffa505-08c7-450f-88d0-f42957f56eff"
  const pathSegments = url.pathname.split("/");

  // for the given URL, the array will be ["", "my-account", "content", "adffa505-08c7-450f-88d0-f42957f56eff"]
  // the account part is at index 1 of the array
  return pathSegments.at(1);
};
