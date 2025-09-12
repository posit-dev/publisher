// Copyright (C) 2025 by Posit Software, PBC.

import { describe, expect, beforeEach, test, vi } from "vitest";
import { window, ProgressLocation } from "vscode";
import { HostToWebviewMessageType } from "src/types/messages/hostToWebviewMessages";
import { WebviewConduit } from "src/utils/webviewConduit";
import {
  ErrorNoQuarto,
  ErrorQuartoRender,
} from "src/utils/quartoProjectHelper";
import { renderQuartoContent } from "./renders";

vi.mock("vscode", () => {
  // mock Disposable
  const disposableMock = vi.fn();
  disposableMock.prototype.dispose = vi.fn();

  // mock window
  const windowMock = {
    showErrorMessage: vi.fn(),
    showInformationMessage: vi.fn(),
    withProgress: vi.fn().mockImplementation(async (_, progressCallback) => {
      await progressCallback();
    }),
  };

  return {
    Disposable: disposableMock,
    window: windowMock,
    ProgressLocation: {
      SourceControl: 1,
      Window: 10,
      Notification: 15,
    },
  };
});

vi.mock("src/api", () => ({
  useApi() {
    return { files: {} };
  },
}));

const quartoHelperRenderSpy = vi.fn();
vi.mock("src/utils/quartoProjectHelper", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("src/utils/quartoProjectHelper")>();

  class mockQuartoHelper {
    render() {
      return quartoHelperRenderSpy();
    }
  }

  return {
    ...actual, // Spread the original module's exports
    QuartoProjectHelper: mockQuartoHelper,
  };
});

const conduitSendMsgSpy = vi.fn();
vi.mock("src/utils/webviewConduit", () => {
  class mockWebviewConduit {
    sendMsg(param: { kind: HostToWebviewMessageType }) {
      conduitSendMsgSpy(param);
    }
  }

  return {
    WebviewConduit: mockWebviewConduit,
  };
});

describe("renderQuartoContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("calls to render with progress notification and emits webview render message", async () => {
    await renderQuartoContent(
      new WebviewConduit(),
      "project-dir",
      "index.qmd",
      "output_dir/index.html",
    );
    expect(window.withProgress).toHaveBeenCalledWith(
      {
        location: ProgressLocation.Notification,
        title: "Rendering Quarto content",
      },
      expect.any(Function),
    );
    expect(quartoHelperRenderSpy).toHaveBeenCalled();
    expect(window.showInformationMessage).toHaveBeenCalledWith(
      "Finished rendering Quarto content.",
    );
    expect(conduitSendMsgSpy).toHaveBeenCalledWith({
      kind: HostToWebviewMessageType.CONTENT_RENDER_SUCCESS,
    });
  });

  describe("errors", () => {
    test("any error emits webview render failure message", async () => {
      quartoHelperRenderSpy.mockRejectedValueOnce("unknown rejection");
      await renderQuartoContent(
        new WebviewConduit(),
        "project-dir",
        "index.qmd",
        "output_dir/index.html",
      );

      expect(quartoHelperRenderSpy).toHaveBeenCalled();
      expect(window.showInformationMessage).not.toHaveBeenCalled();
      expect(window.showErrorMessage).toHaveBeenCalledWith(
        "Unknown error trying to render Quarto content.",
      );
      expect(conduitSendMsgSpy).toHaveBeenCalledWith({
        kind: HostToWebviewMessageType.CONTENT_RENDER_FAILURE,
        content: {
          error: "Unknown error trying to render Quarto content.",
        },
      });
    });

    test("ErrorNoQuarto", async () => {
      quartoHelperRenderSpy.mockRejectedValueOnce(new ErrorNoQuarto());
      await renderQuartoContent(
        new WebviewConduit(),
        "project-dir",
        "index.qmd",
        "output_dir/index.html",
      );

      expect(quartoHelperRenderSpy).toHaveBeenCalled();
      expect(window.showInformationMessage).not.toHaveBeenCalled();
      expect(window.showErrorMessage).toHaveBeenCalledWith(
        "Cannot render Quarto content. Quarto is not available on the system.",
      );
      expect(conduitSendMsgSpy).toHaveBeenCalledWith({
        kind: HostToWebviewMessageType.CONTENT_RENDER_FAILURE,
        content: {
          error:
            "Cannot render Quarto content. Quarto is not available on the system.",
        },
      });
    });

    test("ErrorQuartoRender", async () => {
      quartoHelperRenderSpy.mockRejectedValueOnce(new ErrorQuartoRender());
      await renderQuartoContent(
        new WebviewConduit(),
        "project-dir",
        "index.qmd",
        "output_dir/index.html",
      );

      expect(quartoHelperRenderSpy).toHaveBeenCalled();
      expect(window.showInformationMessage).not.toHaveBeenCalled();
      expect(window.showErrorMessage).toHaveBeenCalledWith(
        "Could not render Quarto project.",
      );
      expect(conduitSendMsgSpy).toHaveBeenCalledWith({
        kind: HostToWebviewMessageType.CONTENT_RENDER_FAILURE,
        content: {
          error: "Could not render Quarto project.",
        },
      });
    });

    test("Unknown Error", async () => {
      quartoHelperRenderSpy.mockRejectedValueOnce(new Error("system is down"));
      await renderQuartoContent(
        new WebviewConduit(),
        "project-dir",
        "index.qmd",
        "output_dir/index.html",
      );

      expect(quartoHelperRenderSpy).toHaveBeenCalled();
      expect(window.showInformationMessage).not.toHaveBeenCalled();
      expect(window.showErrorMessage).toHaveBeenCalledWith(
        "Unknown error trying to render Quarto content. Error: system is down",
      );
      expect(conduitSendMsgSpy).toHaveBeenCalledWith({
        kind: HostToWebviewMessageType.CONTENT_RENDER_FAILURE,
        content: {
          error:
            "Unknown error trying to render Quarto content. Error: system is down",
        },
      });
    });
  });
});
