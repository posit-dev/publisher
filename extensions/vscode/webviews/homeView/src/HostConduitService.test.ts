import { setActivePinia, createPinia } from "pinia";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { App, createApp } from "vue";

import { HostToWebviewMessageType } from "../../../src/types/messages/hostToWebviewMessages";
import { WebviewToHostMessageType } from "../../../src/types/messages/webviewToHostMessages";
import { useHostConduitService } from "src/HostConduitService";
import { useHomeStore } from "src/stores/home";
import { vscodeAPI } from "src/vscode";
import { WebviewApi } from "vscode-webview";

export function withSetup<T>(composable: () => T): App {
  const app = createApp({
    setup() {
      return { ...composable() };
    },
    template: "<div></div>",
  });
  app.mount(document.createElement("div"));
  return app;
}

vi.mock(import("src/vscode"), () => {
  const postMessage = vi.fn();

  const vscodeAPI = vi.fn(() => ({
    postMessage: postMessage,
  }));

  return { vscodeAPI };
});

describe("HostConduitService", () => {
  let vscodeApi: WebviewApi<unknown>;

  beforeEach(() => {
    vscodeApi = vscodeAPI();

    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  test("sends initializing message on when first used", () => {
    withSetup(useHostConduitService);
    expect(vscodeApi.postMessage).toHaveBeenCalledWith(
      JSON.stringify({
        kind: WebviewToHostMessageType.INITIALIZING,
      }),
    );
  });

  test("shows disable overlay on SHOW_DISABLE_OVERLAY message", () => {
    const home = useHomeStore();
    expect(home.showDisabledOverlay).toBe(false);

    withSetup(useHostConduitService);

    const msg = JSON.stringify({
      kind: HostToWebviewMessageType.SHOW_DISABLE_OVERLAY,
    });

    window.dispatchEvent(new MessageEvent("message", { data: msg }));
    expect(home.showDisabledOverlay).toBe(true);
  });

  test("hides disable overlay on HIDE_DISABLE_OVERLAY message", () => {
    const home = useHomeStore();
    expect(home.showDisabledOverlay).toBe(false);
    home.showDisabledOverlay = true;

    withSetup(useHostConduitService);

    const msg = JSON.stringify({
      kind: HostToWebviewMessageType.HIDE_DISABLE_OVERLAY,
    });

    window.dispatchEvent(new MessageEvent("message", { data: msg }));
    expect(home.showDisabledOverlay).toBe(false);
  });
});
