// Copyright (C) 2024 by Posit Software, PBC.

import { Uri, ViewColumn, commands, env, workspace } from "vscode";

// under posit.publisher
const CONFIG_KEY_OPEN_URL_BEHAVIOR = "openUrlBehavior";
type OpenUrlBehaviors = "external" | "main" | "beside";

export const openUrl = async (url: string) => {
  const configuration = workspace.getConfiguration("positPublisher");
  let openUrlBehavior: OpenUrlBehaviors | undefined =
    configuration.get<OpenUrlBehaviors>(CONFIG_KEY_OPEN_URL_BEHAVIOR);

  if (openUrlBehavior === "external") {
    return await env.openExternal(Uri.parse(url, true));
  }
  let viewColumn = ViewColumn.Beside;
  if (openUrlBehavior === "main") {
    viewColumn = ViewColumn.One;
  }

  return commands.executeCommand(
    "posit.publisher.homeView.loadContent",
    url,
    viewColumn,
  );
};
