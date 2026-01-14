// Copyright (C) 2025 by Posit Software, PBC.

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { EventStreamMessage, ProductType } from "src/api";
import { EventStream, UnregisterCallback } from "src/events";
import { LogsTreeDataProvider, LogsTreeStageItem } from "./logs";
import { ExtensionContext, TreeItemCollapsibleState, window } from "vscode";

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
        visible: true,
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

/**
 * Helper to create a publish/success event message
 */
function createPublishSuccessMessage(dashboardUrl: string): EventStreamMessage {
  return {
    type: "publish/success",
    time: new Date().toISOString(),
    data: {
      dashboardUrl,
    },
  };
}

/**
 * Helper to create a stage start event message
 */
function createStageStartMessage(stageName: string): EventStreamMessage {
  return {
    type: `${stageName}/start` as EventStreamMessage["type"],
    time: new Date().toISOString(),
    data: {},
  };
}

/**
 * Helper to create a stage success event message
 */
function createStageSuccessMessage(stageName: string): EventStreamMessage {
  return {
    type: `${stageName}/success` as EventStreamMessage["type"],
    time: new Date().toISOString(),
    data: {},
  };
}

/**
 * Helper to create a stage failure event message
 */
function createStageFailureMessage(
  stageName: string,
  message: string = "Stage failed",
  canceled: boolean = false,
): EventStreamMessage {
  return {
    type: `${stageName}/failure` as EventStreamMessage["type"],
    time: new Date().toISOString(),
    data: {
      message,
      canceled: canceled ? "true" : "false",
    },
  };
}

describe("LogsTreeDataProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Reset treeView visibility to true for test isolation
    const mockTreeView = (window.createTreeView as ReturnType<typeof vi.fn>)
      .mock.results[0]?.value;
    if (mockTreeView) {
      mockTreeView.visible = true;
    }
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

  describe("event handler error isolation", () => {
    test("publish/success handler should not throw exceptions that block other handlers", () => {
      const { stream, emit } = createMockEventStream();
      const context = createMockContext();

      const provider = new LogsTreeDataProvider(context, stream);
      provider.register();

      // Track if subsequent handlers are called
      let subsequentHandlerCalled = false;
      stream.register("publish/success", () => {
        subsequentHandlerCalled = true;
      });

      // Start a deployment first to initialize state
      emit("publish/start", createPublishStartMessage("App1", "server1.com"));

      // Emit publish/success - even if LogsTreeDataProvider's handler had an issue,
      // it should not throw and block subsequent handlers
      expect(() => {
        emit(
          "publish/success",
          createPublishSuccessMessage("https://example.com"),
        );
      }).not.toThrow();

      // Verify subsequent handlers were still called
      expect(subsequentHandlerCalled).toBe(true);
    });

    test("publish/start handler should not throw exceptions that block other handlers", () => {
      const { stream, emit } = createMockEventStream();
      const context = createMockContext();

      const provider = new LogsTreeDataProvider(context, stream);
      provider.register();

      // Track if subsequent handlers are called
      let subsequentHandlerCalled = false;
      stream.register("publish/start", () => {
        subsequentHandlerCalled = true;
      });

      // Emit publish/start - should not throw
      expect(() => {
        emit("publish/start", createPublishStartMessage("App1", "server1.com"));
      }).not.toThrow();

      // Verify subsequent handlers were still called
      expect(subsequentHandlerCalled).toBe(true);
    });
  });

  describe("stage collapsible state behavior", () => {
    test("should expand stage when it starts running (inProgress)", () => {
      const { stream, emit } = createMockEventStream();
      const context = createMockContext();

      const provider = new LogsTreeDataProvider(context, stream);
      provider.register();

      // Start a deployment
      emit("publish/start", createPublishStartMessage("App1", "server1.com"));

      // Start the createBundle stage
      emit(
        "publish/createBundle/start",
        createStageStartMessage("publish/createBundle"),
      );

      // Get the tree and find the createBundle stage
      const children = provider.getChildren(undefined) as LogsTreeStageItem[];
      const root = children[0]!;
      const stages = provider.getChildren(root) as LogsTreeStageItem[];
      const createBundleStage = stages.find(
        (s) => s.stage.inactiveLabel === "Create Bundle",
      );

      expect(createBundleStage).toBeDefined();
      expect(createBundleStage!.collapsibleState).toBe(
        TreeItemCollapsibleState.Expanded,
      );
    });

    test("should collapse stage when it completes successfully", () => {
      const { stream, emit } = createMockEventStream();
      const context = createMockContext();

      const provider = new LogsTreeDataProvider(context, stream);
      provider.register();

      // Start a deployment
      emit("publish/start", createPublishStartMessage("App1", "server1.com"));

      // Start and complete the createBundle stage
      emit(
        "publish/createBundle/start",
        createStageStartMessage("publish/createBundle"),
      );
      emit(
        "publish/createBundle/success",
        createStageSuccessMessage("publish/createBundle"),
      );

      // Get the tree and find the createBundle stage
      const children = provider.getChildren(undefined) as LogsTreeStageItem[];
      const root = children[0]!;
      const stages = provider.getChildren(root) as LogsTreeStageItem[];
      const createBundleStage = stages.find(
        (s) => s.stage.inactiveLabel === "Create Bundle",
      );

      expect(createBundleStage).toBeDefined();
      expect(createBundleStage!.collapsibleState).toBe(
        TreeItemCollapsibleState.Collapsed,
      );
    });

    test("should expand stage when it fails", () => {
      const { stream, emit } = createMockEventStream();
      const context = createMockContext();

      const provider = new LogsTreeDataProvider(context, stream);
      provider.register();

      // Start a deployment
      emit("publish/start", createPublishStartMessage("App1", "server1.com"));

      // Start and fail the createBundle stage
      emit(
        "publish/createBundle/start",
        createStageStartMessage("publish/createBundle"),
      );
      emit(
        "publish/createBundle/failure",
        createStageFailureMessage(
          "publish/createBundle",
          "Bundle creation failed",
        ),
      );

      // Get the tree and find the createBundle stage
      const children = provider.getChildren(undefined) as LogsTreeStageItem[];
      const root = children[0]!;
      const stages = provider.getChildren(root) as LogsTreeStageItem[];
      const createBundleStage = stages.find(
        (s) => s.stage.inactiveLabel === "Create Bundle",
      );

      expect(createBundleStage).toBeDefined();
      expect(createBundleStage!.collapsibleState).toBe(
        TreeItemCollapsibleState.Expanded,
      );
    });

    test("should expand stage when it is canceled", () => {
      const { stream, emit } = createMockEventStream();
      const context = createMockContext();

      const provider = new LogsTreeDataProvider(context, stream);
      provider.register();

      // Start a deployment
      emit("publish/start", createPublishStartMessage("App1", "server1.com"));

      // Start and cancel the createBundle stage
      emit(
        "publish/createBundle/start",
        createStageStartMessage("publish/createBundle"),
      );
      emit(
        "publish/createBundle/failure",
        createStageFailureMessage(
          "publish/createBundle",
          "Canceled by user",
          true,
        ),
      );

      // Get the tree and find the createBundle stage
      const children = provider.getChildren(undefined) as LogsTreeStageItem[];
      const root = children[0]!;
      const stages = provider.getChildren(root) as LogsTreeStageItem[];
      const createBundleStage = stages.find(
        (s) => s.stage.inactiveLabel === "Create Bundle",
      );

      expect(createBundleStage).toBeDefined();
      expect(createBundleStage!.collapsibleState).toBe(
        TreeItemCollapsibleState.Expanded,
      );
    });

    test("completed leaf stage should have modified ID to force VSCode to respect collapsibleState", () => {
      const { stream, emit } = createMockEventStream();
      const context = createMockContext();

      const provider = new LogsTreeDataProvider(context, stream);
      provider.register();

      // Start a deployment
      emit("publish/start", createPublishStartMessage("App1", "server1.com"));

      // Start and complete the createBundle stage
      emit(
        "publish/createBundle/start",
        createStageStartMessage("publish/createBundle"),
      );
      emit(
        "publish/createBundle/success",
        createStageSuccessMessage("publish/createBundle"),
      );

      // Get the tree and find the createBundle stage
      const children = provider.getChildren(undefined) as LogsTreeStageItem[];
      const root = children[0]!;
      const stages = provider.getChildren(root) as LogsTreeStageItem[];
      const createBundleStage = stages.find(
        (s) => s.stage.inactiveLabel === "Create Bundle",
      );

      expect(createBundleStage).toBeDefined();
      // Completed leaf stages should have -completed suffix in ID
      expect(createBundleStage!.id).toBe("Create Bundle-completed");
    });

    test("in-progress leaf stage should have original ID", () => {
      const { stream, emit } = createMockEventStream();
      const context = createMockContext();

      const provider = new LogsTreeDataProvider(context, stream);
      provider.register();

      // Start a deployment
      emit("publish/start", createPublishStartMessage("App1", "server1.com"));

      // Start the createBundle stage (but don't complete it)
      emit(
        "publish/createBundle/start",
        createStageStartMessage("publish/createBundle"),
      );

      // Get the tree and find the createBundle stage
      const children = provider.getChildren(undefined) as LogsTreeStageItem[];
      const root = children[0]!;
      const stages = provider.getChildren(root) as LogsTreeStageItem[];
      const createBundleStage = stages.find(
        (s) => s.stage.inactiveLabel === "Create Bundle",
      );

      expect(createBundleStage).toBeDefined();
      // In-progress stages should have original ID (no suffix)
      expect(createBundleStage!.id).toBe("Create Bundle");
    });

    test("root publishing stage should keep original ID when completed", () => {
      const { stream, emit } = createMockEventStream();
      const context = createMockContext();

      const provider = new LogsTreeDataProvider(context, stream);
      provider.register();

      // Start and complete a deployment
      emit("publish/start", createPublishStartMessage("App1", "server1.com"));
      emit(
        "publish/success",
        createPublishSuccessMessage("https://example.com/dashboard"),
      );

      // Get the root stage
      const children = provider.getChildren(undefined) as LogsTreeStageItem[];
      const root = children[0]!;

      // Root stage (which has child stages) should NOT have -completed suffix
      // to prevent it from collapsing and hiding all child stages
      expect(root.id).not.toContain("-completed");
    });
  });

  describe("logs view visibility behavior", () => {
    test("should open logs view when deployment starts", () => {
      const { stream, emit } = createMockEventStream();
      const context = createMockContext();

      const provider = new LogsTreeDataProvider(context, stream);
      provider.register();

      // Get the mock treeView
      const mockTreeView = (window.createTreeView as ReturnType<typeof vi.fn>)
        .mock.results[0]?.value;

      // Clear any previous reveal calls
      mockTreeView.reveal.mockClear();

      // Start a deployment
      emit("publish/start", createPublishStartMessage("App1", "server1.com"));

      // Verify reveal was called to open the logs view
      expect(mockTreeView.reveal).toHaveBeenCalled();
    });

    test("should open logs view when deployment starts even if view was closed", () => {
      const { stream, emit } = createMockEventStream();
      const context = createMockContext();

      const provider = new LogsTreeDataProvider(context, stream);
      provider.register();

      // Get the mock treeView and set visible to false (simulating closed view)
      const mockTreeView = (window.createTreeView as ReturnType<typeof vi.fn>)
        .mock.results[0]?.value;
      mockTreeView.visible = false;
      mockTreeView.reveal.mockClear();

      // Start a deployment
      emit("publish/start", createPublishStartMessage("App1", "server1.com"));

      // Verify reveal was still called (unconditionally opens logs view)
      expect(mockTreeView.reveal).toHaveBeenCalled();
    });

    test("should not expand stage when view is not visible", () => {
      const { stream, emit } = createMockEventStream();
      const context = createMockContext();

      const provider = new LogsTreeDataProvider(context, stream);
      provider.register();

      // Get the mock treeView
      const mockTreeView = (window.createTreeView as ReturnType<typeof vi.fn>)
        .mock.results[0]?.value;

      // Start a deployment (this opens the view)
      emit("publish/start", createPublishStartMessage("App1", "server1.com"));

      // Now set visible to false (user closed the view)
      mockTreeView.visible = false;
      mockTreeView.reveal.mockClear();

      // Start a stage
      emit(
        "publish/createBundle/start",
        createStageStartMessage("publish/createBundle"),
      );

      // Verify reveal was NOT called (view not visible)
      expect(mockTreeView.reveal).not.toHaveBeenCalled();
    });
  });

  describe("auto-scroll behavior", () => {
    test("should reveal latest log item when log event is received and view is visible", () => {
      const { stream, emit } = createMockEventStream();
      const context = createMockContext();

      const provider = new LogsTreeDataProvider(context, stream);
      provider.register();

      // Get the mock treeView
      const mockTreeView = (window.createTreeView as ReturnType<typeof vi.fn>)
        .mock.results[0]?.value;

      // Clear any previous reveal calls
      mockTreeView.reveal.mockClear();

      // Start a deployment
      emit("publish/start", createPublishStartMessage("App1", "server1.com"));

      // Start a stage
      emit(
        "publish/createBundle/start",
        createStageStartMessage("publish/createBundle"),
      );

      // Clear reveal calls from stage start
      mockTreeView.reveal.mockClear();

      // Emit a log event
      emit(
        "publish/createBundle/log",
        createStageLogMessage("publish/createBundle", "Building bundle..."),
      );

      // Verify reveal was called (auto-scroll)
      expect(mockTreeView.reveal).toHaveBeenCalled();
    });

    test("should not reveal when view is not visible", () => {
      const { stream, emit } = createMockEventStream();
      const context = createMockContext();

      const provider = new LogsTreeDataProvider(context, stream);
      provider.register();

      // Get the mock treeView and set visible to false
      const mockTreeView = (window.createTreeView as ReturnType<typeof vi.fn>)
        .mock.results[0]?.value;
      mockTreeView.visible = false;

      // Clear any previous reveal calls
      mockTreeView.reveal.mockClear();

      // Start a deployment
      emit("publish/start", createPublishStartMessage("App1", "server1.com"));

      // Start a stage
      emit(
        "publish/createBundle/start",
        createStageStartMessage("publish/createBundle"),
      );

      // Clear reveal calls from stage start
      mockTreeView.reveal.mockClear();

      // Emit a log event
      emit(
        "publish/createBundle/log",
        createStageLogMessage("publish/createBundle", "Building bundle..."),
      );

      // Verify reveal was NOT called (view not visible)
      expect(mockTreeView.reveal).not.toHaveBeenCalled();
    });
  });
});
