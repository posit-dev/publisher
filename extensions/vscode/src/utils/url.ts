// Copyright (C) 2024 by Posit Software, PBC.

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

// Removes '/connect' and trailing paths from Connect server URLs
export const normalizeConnectURL = (input: string): string => {
  const formatted = formatURL(input);

  try {
    const url = new URL(formatted);

    const connectIndex = url.pathname.indexOf("/connect");
    if (connectIndex !== -1) {
      const afterConnect = url.pathname.substring(
        connectIndex + "/connect".length,
      );

      // Only trim if /connect is at the end of the URL
      // or followed by a path separator
      if (afterConnect === "" || afterConnect.startsWith("/")) {
        // Keep everything before /connect in the pathname
        url.pathname = url.pathname.substring(0, connectIndex);

        // Clear hash and search params
        url.hash = "";
        url.search = "";

        // Return the new URL and remove trailing slash if present
        return url.toString().replace(/\/$/, "");
      }
    }
  } catch {
    return formatted;
  }

  return formatted;
};
