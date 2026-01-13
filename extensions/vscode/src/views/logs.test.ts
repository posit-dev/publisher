// Copyright (C) 2025 by Posit Software, PBC.

import { beforeEach, describe, expect, test, vi } from "vitest";
import { EventStreamMessage, ProductType } from "src/api";
import { EventStream, UnregisterCallback } from "src/events";
import { LogsTreeDataProvider, LogsTreeStageItem } from "./logs";
import { ExtensionContext } from "vscode";

// Mock vscode module
vi.mock("vscode", () => {
  class EventEmitter {
    event = vi.fn();
    fire = vi.fn();
  }

  class TreeItem {
    label: string;
    collapsibleState: number;
    id?: string;
    iconPath?: unknown;
    tooltip?: string;
    command?: unknown;

    constructor(label: string, collapsibleState: number) {
      this.label = label;
      this.collapsibleState = collapsibleState;
    }
  }

  class ThemeIcon {
    id: string;
    constructor(id: string) {
      this.id = id;
    }
  }

  class ThemeColor {
    id: string;
    constructor(id: string) {
      this.id = id;
    }
  }

  return {
    EventEmitter,
    TreeItemCollapsibleState: {
      None: 0,
      Collapsed: 1,
      Expanded: 2,
    },
    TreeItem,
    ThemeIcon,
    ThemeColor,
    window: {
      createTreeView: vi.fn().mockReturnValue({
        onDidChangeVisibility: vi.fn(),
        reveal: vi.fn(),
      }),
      showInformationMessage: vi.fn(),
      showErrorMessage: vi.fn(),
    },
    commands: {
      registerCommand: vi.fn(),
      executeCommand: vi.fn(),
    },
    workspace: {
      openTextDocument: vi.fn(),
    },
    env: {
      clipboard: {
        writeText: vi.fn(),
      },
      openExternal: vi.fn(),
    },
    Uri: {
      parse: vi.fn(),
    },
    Range: vi.fn(),
  };
});

// Mock the extension settings
vi.mock("src/extension", () => ({
  extensionSettings: {
    autoOpenLogsOnFailure: vi.fn().mockReturnValue(false),
  },
}));

// Mock window utilities
vi.mock("src/utils/window", () => ({
  showErrorMessageWithTroubleshoot: vi.fn(),
}));

// Mock deploy handlers
vi.mock("src/views/deployHandlers", () => ({
  DeploymentFailureRenvHandler: vi.fn().mockImplementation(() => ({
    shouldHandleEventMsg: vi.fn().mockReturnValue(false),
    handle: vi.fn(),
  })),
}));

/**
 * Creates a mock EventStream that captures registered callbacks
 */
function createMockEventStream(): {
  stream: EventStream;
  callbacks: Map<string, ((msg: EventStreamMessage) => void)[]>;
  emit: (type: string, msg: EventStreamMessage) => void;
} {
  const callbacks = new Map<string, ((msg: EventStreamMessage) => void)[]>();

  const stream = {
    register: vi.fn(
      (
        type: string,
        callback: (msg: EventStreamMessage) => void,
      ): UnregisterCallback => {
        if (!callbacks.has(type)) {
          callbacks.set(type, []);
        }
        callbacks.get(type)!.push(callback);
        return {
          unregister: () => {
            const cbs = callbacks.get(type);
            if (cbs) {
              const index = cbs.indexOf(callback);
              if (index > -1) {
                cbs.splice(index, 1);
              }
            }
          },
        };
      },
    ),
  } as unknown as EventStream;

  const emit = (type: string, msg: EventStreamMessage) => {
    const cbs = callbacks.get(type);
    if (cbs) {
      cbs.forEach((cb) => cb(msg));
    }
  };

  return { stream, callbacks, emit };
}

/**
 * Creates a mock ExtensionContext
 */
function createMockContext(): ExtensionContext {
  return {
    subscriptions: {
      push: vi.fn(),
    },
  } as unknown as ExtensionContext;
}

/**
 * Helper to create a publish/start event message
 */
function createPublishStartMessage(
  title: string,
  server: string,
  productType: ProductType = ProductType.CONNECT,
): EventStreamMessage {
  return {
    type: "publish/start",
    time: new Date().toISOString(),
    data: {
      title,
      server,
      productType,
    },
  };
}

/**
 * Helper to create a stage log event message
 */
function createStageLogMessage(
  stageName: string,
  message: string,
  level: string = "INFO",
): EventStreamMessage {
  return {
    type: `${stageName}/log` as EventStreamMessage["type"],
    time: new Date().toISOString(),
    data: {
      message,
      level,
    },
  };
}

describe("LogsTreeDataProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("resetStages on multiple deployments", () => {
    test("should clear events from previous deployment when a new publish/start occurs", () => {
      const { stream, emit } = createMockEventStream();
      const context = createMockContext();

      const provider = new LogsTreeDataProvider(context, stream);
      provider.register();

      // === First Deployment ===
      emit("publish/start", createPublishStartMessage("App1", "server1.com"));

      // Add log events for the first deployment
      emit(
        "publish/createBundle/log",
        createStageLogMessage(
          "publish/createBundle",
          "First deployment: Creating bundle...",
        ),
      );
      emit(
        "publish/createBundle/log",
        createStageLogMessage(
          "publish/createBundle",
          "First deployment: Bundle created",
        ),
      );

      // Verify first deployment has events
      let children = provider.getChildren(undefined) as LogsTreeStageItem[];
      expect(children).toHaveLength(1);

      const firstRoot = children[0]!;
      expect(firstRoot.label).toContain("App1");

      // Get the createBundle stage from the first deployment
      const firstStages = provider.getChildren(
        firstRoot,
      ) as LogsTreeStageItem[];
      const firstCreateBundleStage = firstStages.find(
        (s) => s.stage.inactiveLabel === "Create Bundle",
      );
      expect(firstCreateBundleStage).toBeDefined();
      expect(firstCreateBundleStage!.events).toHaveLength(2);
      expect(firstCreateBundleStage!.events[0]?.data.message).toContain(
        "First deployment",
      );

      // === Second Deployment ===
      emit("publish/start", createPublishStartMessage("App2", "server2.com"));

      // Add log events for the second deployment
      emit(
        "publish/createBundle/log",
        createStageLogMessage(
          "publish/createBundle",
          "Second deployment: Creating bundle...",
        ),
      );

      // Get the tree again after second deployment
      children = provider.getChildren(undefined) as LogsTreeStageItem[];
      expect(children).toHaveLength(1);

      const secondRoot = children[0]!;
      expect(secondRoot.label).toContain("App2");

      // Get the createBundle stage from the second deployment
      const secondStages = provider.getChildren(
        secondRoot,
      ) as LogsTreeStageItem[];
      const secondCreateBundleStage = secondStages.find(
        (s) => s.stage.inactiveLabel === "Create Bundle",
      );

      expect(secondCreateBundleStage).toBeDefined();

      // After the second publish/start, the events array should only contain
      // events from the second deployment (1 event)
      expect(secondCreateBundleStage!.events).toHaveLength(1);
      expect(secondCreateBundleStage!.events[0]?.data.message).toContain(
        "Second deployment",
      );

      // The first deployment's events should NOT be present
      const hasFirstDeploymentEvent = secondCreateBundleStage!.events.some(
        (e) => e.data.message?.includes("First deployment"),
      );
      expect(hasFirstDeploymentEvent).toBe(false);
    });
  });
});
