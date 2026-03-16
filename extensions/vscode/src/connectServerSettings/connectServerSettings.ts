// Copyright (C) 2026 by Posit Software, PBC.

import axios from "axios";
import { ServerSettings } from "src/api/types/connect";

export async function fetchServerSettings(
  url: string,
  apiKey: string,
): Promise<ServerSettings> {
  const response = await axios.get<ServerSettings>(
    new URL("/__api__/server_settings", url).toString(),
    {
      headers: { Authorization: `Key ${apiKey}` },
      timeout: 30_000,
    },
  );
  return response.data;
}
