// Copyright (C) 2025 by Posit Software, PBC.

import { window, ProgressLocation } from "vscode";
import { useApi } from "src/api";
import { HostToWebviewMessageType } from "src/types/messages/hostToWebviewMessages";
import { WebviewConduit } from "src/utils/webviewConduit";
import {
  ErrorNoQuarto,
  ErrorQuartoRender,
  QuartoProjectHelper,
} from "src/utils/quartoProjectHelper";

export const renderQuartoContent = async (
  conduit: WebviewConduit,
  projectDir: string,
  sourceEntrypoint: string,
  renderedEntrypoint: string,
) => {
  try {
    await window.withProgress(
      {
        location: ProgressLocation.Notification,
        title: "Rendering Quarto content",
      },
      async () => {
        const api = await useApi();
        const quartoHelper = new QuartoProjectHelper(
          api.files,
          sourceEntrypoint,
          renderedEntrypoint,
          projectDir,
        );
        await quartoHelper.render();
      },
    );
    window.showInformationMessage("Finished rendering Quarto content.");
    conduit.sendMsg({
      kind: HostToWebviewMessageType.CONTENT_RENDER_FINISHED,
    });
  } catch (err: unknown) {
    let errMsg = "Unknown error trying to render Quarto content.";
    if (err instanceof ErrorNoQuarto) {
      errMsg =
        "Cannot render Quarto content. Quarto is not available on the system.";
    } else if (err instanceof ErrorQuartoRender) {
      errMsg = err.message;
    } else if (err instanceof Error) {
      errMsg = `Unknown error trying to render Quarto content. Error: ${err.message}`;
    }
    window.showErrorMessage(errMsg);
    conduit.sendMsg({
      kind: HostToWebviewMessageType.CONTENT_RENDER_FAILURE,
      content: {
        error: errMsg,
      },
    });
  }
};
