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

export const extractConnectCloudAccount = (input: string) => {
  // sample URL: "https://connect.posit.cloud/my-account/content/adffa505-08c7-450f-88d0-f42957f56eff"
  const url = new URL(input);

  // the pathname is the part of the URL after the domain, e.g., "/my-account/content/adffa505-08c7-450f-88d0-f42957f56eff"
  const pathSegments = url.pathname.split("/");

  // for the given URL, the array will be ["", "my-account", "content", "adffa505-08c7-450f-88d0-f42957f56eff"]
  // the account part is at index 1 of the array
  return pathSegments.at(1);
};
