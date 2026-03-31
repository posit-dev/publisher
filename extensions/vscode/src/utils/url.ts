// Copyright (C) 2025 by Posit Software, PBC.

import config from "../../src/config";
import { extractGUID } from "./guid";
import { ServerType } from "../api/types/contentRecords";

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

export const extractConnectCloudAccount = (input: string) => {
  // sample URL: "https://connect.posit.cloud/my-account/content/adffa505-08c7-450f-88d0-f42957f56eff"
  const url = new URL(input);

  // the pathname is the part of the URL after the domain, e.g., "/my-account/content/adffa505-08c7-450f-88d0-f42957f56eff"
  const pathSegments = url.pathname.split("/");

  // for the given URL, the array will be ["", "my-account", "content", "adffa505-08c7-450f-88d0-f42957f56eff"]
  // the account part is at index 1 of the array
  return pathSegments.at(1);
};

/**
 * Infers a ServerType from a URL hostname.
 * Port of Go's `server_type.ServerTypeFromURL`.
 */
export function serverTypeFromURL(urlStr: string): ServerType {
  const u = new URL(urlStr);
  const host = u.hostname;
  if (host.endsWith("connect.posit.cloud")) {
    return ServerType.CONNECT_CLOUD;
  } else if (host.endsWith(".snowflakecomputing.app")) {
    return ServerType.SNOWFLAKE;
  } else if (host.endsWith(".privatelink.snowflake.app")) {
    return ServerType.SNOWFLAKE;
  }
  return ServerType.CONNECT;
}

/**
 * Generates a list of URLs by progressively adding path segments.
 * Port of Go's `util.GetListOfPossibleURLs`.
 *
 * Input: "https://host.com/a/b/c"
 * Output: ["https://host.com", "https://host.com/a", "https://host.com/a/b", "https://host.com/a/b/c"]
 */
export function getListOfPossibleURLs(accountURL: string): string[] {
  const u = new URL(accountURL);
  // Clear query and fragment
  u.search = "";
  u.hash = "";

  // Split path into non-empty segments
  const segments = u.pathname.split("/").filter((s) => s !== "");

  // Build list starting with no path
  u.pathname = "";
  const urls: string[] = [u.toString().replace(/\/$/, "")];

  let currentPath = "";
  for (const seg of segments) {
    currentPath += "/" + seg;
    u.pathname = currentPath;
    urls.push(u.toString().replace(/\/$/, ""));
  }

  return urls;
}

/** Function type that tests if a URL is valid/accessible. */
export type URLTester = (url: string) => Promise<void>;

/**
 * Attempts to find the correct server URL by testing possible URLs
 * derived from the provided URL. Walks backwards (longest path first).
 * Port of Go's `util.DiscoverServerURL`.
 */
export async function discoverServerURL(
  providedURL: string,
  tester: URLTester,
): Promise<{ url: string; error?: unknown }> {
  let possibleURLs: string[];
  try {
    possibleURLs = getListOfPossibleURLs(providedURL);
  } catch (err) {
    return { url: providedURL, error: err };
  }

  let lastError: unknown;

  // Walk backwards — prioritize full URL with all path segments
  for (let i = possibleURLs.length - 1; i >= 0; i--) {
    try {
      await tester(possibleURLs[i]!);
      return { url: possibleURLs[i]! };
    } catch (err) {
      lastError = err;
    }
  }

  return { url: providedURL, error: lastError };
}
