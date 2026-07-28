// Copyright (C) 2025 by Posit Software, PBC.

import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import { ServerType } from "src/api/types/contentRecords";
import { newConnectCredential } from "./newConnectCredential";

const CANCEL = Symbol("cancel");

// Per-step responses for showInputBox, keyed by step name
const inputBoxResponses: Record<string, string> = {
  inputServerUrl: "https://connect.example.com",
  inputAPIKey: "mock-api-key-value",
};

// Which auth-method QuickPick option the mock selects. Defaults to "API Key"
// so existing tests take the API-key path; OAuth tests override it.
const stepControl = { quickPickLabel: "API Key" };

// Mock the MultiStepInput module with a real step-through implementation
vi.mock("./multiStepHelper", () => {
  class AbortError extends Error {}

  return {
    AbortError,
    MultiStepInput: {
      run: vi.fn(
        async (start: { name?: string; step: (input: unknown) => unknown }) => {
          let currentStep:
            | { name?: string; step: (input: unknown) => unknown }
            | void
            | undefined = start;

          while (currentStep) {
            const stepName = currentStep.name || "";
            const mockInput = {
              showInputBox: vi.fn(() => {
                const value = inputBoxResponses[stepName] || "mocked-value";
                return Promise.resolve(value);
              }),
              showQuickPick: vi.fn(
                ({ items }: { items: { label: string }[] }) => {
                  return Promise.resolve(
                    items.find((i) => i.label === stepControl.quickPickLabel) ||
                      items[0],
                  );
                },
              ),
              showInfoMessage: vi.fn(
                async (params?: { apiFunction?: () => Promise<unknown> }) => {
                  // Drive the polling primitive by invoking apiFunction once,
                  // mirroring a successful (single) poll.
                  if (params && typeof params.apiFunction === "function") {
                    return await params.apiFunction();
                  }
                  return undefined;
                },
              ),
            };

            try {
              currentStep = (await currentStep.step(mockInput)) as {
                name?: string;
                step: (input: unknown) => unknown;
              } | void;
            } catch (e) {
              if (e === CANCEL) {
                currentStep = undefined;
              } else {
                throw e;
              }
            }
          }
        },
      ),
    },
    assignStep: (
      state: { step: number; promptStepNumbers: Record<string, number> },
      stepName: string,
    ) => {
      state.step += 1;
      state.promptStepNumbers[stepName] = state.step;
      return state.step;
    },
    isString: (d: unknown): d is string => typeof d === "string",
    isQuickPickItemWithIndex: vi.fn(() => false),
  };
});

// Mock vscode
vi.mock("vscode", () => {
  const mockOutputChannel = {
    appendLine: vi.fn(),
    append: vi.fn(),
    clear: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
    dispose: vi.fn(),
  };

  return {
    window: {
      showErrorMessage: vi.fn(),
      showInformationMessage: vi.fn(),
      showWarningMessage: vi.fn(),
      createOutputChannel: vi.fn(() => mockOutputChannel),
    },
    env: {
      openExternal: vi.fn(() => Promise.resolve(true)),
    },
    InputBoxValidationSeverity: {
      Error: 3,
      Warning: 2,
      Information: 1,
    },
    Uri: {
      parse: vi.fn((url: string) => ({ toString: () => url })),
    },
    ThemeIcon: function (iconId: string) {
      return { id: iconId };
    },
    TreeItem: class TreeItem {
      label: string;
      collapsibleState: number;
      constructor(label: string, collapsibleState: number) {
        this.label = label;
        this.collapsibleState = collapsibleState;
      }
    },
    l10n: {
      t: (message: string, ..._args: unknown[]) => message,
      uri: { scheme: "l10n", path: "", query: "" },
    },
    EventEmitter: class EventEmitter {
      event = vi.fn();
      fire = vi.fn();
      dispose = vi.fn();
    },
  };
});

vi.mock("src/api", () => {
  return {
    ServerType: { CONNECT: "connect" },
    ProductName: { CONNECT: "Posit Connect" },
    PlatformName: { CONNECT: "Posit Connect" },
    ProductDescription: { CONNECT: "Posit Connect Description" },
    ProductType: { CONNECT: "connect", CONNECT_CLOUD: "connect_cloud" },
  };
});

// Mock CredentialsService
const mockCredentialsServiceList = vi.fn();
const mockCredentialsServiceCreate = vi.fn();
const mockCredentialsService = {
  list: mockCredentialsServiceList,
  create: mockCredentialsServiceCreate,
};

vi.mock("src/credentials/service", () => ({
  CredentialsService: vi.fn(),
}));

vi.mock("src/utils/progress", () => {
  return {
    showProgress: vi.fn(
      (_title: string, _view: string, callback: () => unknown) => callback(),
    ),
  };
});

vi.mock("src/multiStepInputs/common", () => {
  return {
    findExistingCredentialByURL: vi.fn(() => undefined),
    fetchSnowflakeConnections: vi.fn(() =>
      Promise.resolve({ connections: [], connectionQuickPicks: [] }),
    ),
    inputCredentialNameStep: vi.fn(() => Promise.resolve("My Credential")),
    getExistingCredentials: vi.fn(() => Promise.resolve([])),
  };
});

vi.mock("src/utils/multiStepHelpers", () => ({
  isConnect: vi.fn(() => true),
  isSnowflake: vi.fn(() => false),
}));

vi.mock("src/snowflake/connections", () => ({
  listConnections: vi.fn(() => ({})),
}));

vi.mock("src/commands", () => ({
  openConfigurationCommand: "command:open-config",
}));

vi.mock("src/extension", () => ({
  extensionSettings: {
    defaultConnectServer: vi.fn(() => Promise.resolve("")),
    verifyCertificates: vi.fn(() => true),
  },
}));

vi.mock("src/utils/url", () => ({
  formatURL: vi.fn((url: string) => url),
}));

vi.mock("src/utils/apiKeys", () => ({
  checkSyntaxApiKey: vi.fn(() => undefined),
}));

vi.mock("src/utils/testCredentials", () => ({
  testServerURL: vi.fn(() => Promise.resolve({ serverType: "connect" })),
  testAuthentication: vi.fn(() => Promise.resolve({})),
}));

vi.mock("src/auth/ConnectAuthTokenActivator", () => ({
  ConnectAuthTokenActivator: vi.fn(),
  TokenAuthResult: {},
}));

const oauthStepperMocks = vi.hoisted(() => ({
  discoverOAuthMetadata: vi.fn(),
  authenticate: vi.fn(),
}));

vi.mock("src/auth/oauth", () => ({
  discoverOAuthMetadata: oauthStepperMocks.discoverOAuthMetadata,
  ConnectOAuthActivator: class {
    authenticate = oauthStepperMocks.authenticate;
  },
}));

vi.mock("src/utils/errors", () => ({
  getMessageFromError: vi.fn((e: unknown) => String(e)),
  getSummaryStringFromError: vi.fn((loc: string, e: unknown) => `${loc}: ${e}`),
}));

describe("newConnectCredential cancellation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stepControl.quickPickLabel = "API Key";

    // Default: server does not support OAuth, so the token/API-key flow runs.
    oauthStepperMocks.discoverOAuthMetadata.mockResolvedValue(null);

    mockCredentialsServiceList.mockResolvedValue([]);
    mockCredentialsServiceCreate.mockResolvedValue({
      guid: "credential-123",
      name: "My Connect Server",
      url: "https://connect.example.com",
      apiKey: "",
      serverType: ServerType.CONNECT,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("cancelling at credential name step does not save the credential", async () => {
    // Mock inputCredentialNameStep to throw cancel (simulating user pressing Escape)
    const { inputCredentialNameStep } =
      await import("src/multiStepInputs/common");
    vi.mocked(inputCredentialNameStep).mockRejectedValue(CANCEL);

    let threw = false;
    try {
      await newConnectCredential(
        "test-view-id",
        "Create a New Credential",
        mockCredentialsService as unknown as import("src/credentials/service").CredentialsService,
        "https://connect.example.com",
      );
    } catch {
      threw = true;
    }

    expect(threw).toBe(true);
    expect(mockCredentialsServiceCreate).not.toHaveBeenCalled();
  });

  test("completing credential name step saves the credential", async () => {
    const { inputCredentialNameStep } =
      await import("src/multiStepInputs/common");
    vi.mocked(inputCredentialNameStep).mockResolvedValue("My Server");

    const result = await newConnectCredential(
      "test-view-id",
      "Create a New Credential",
      mockCredentialsService as unknown as import("src/credentials/service").CredentialsService,
      "https://connect.example.com",
    );

    expect(mockCredentialsServiceCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "My Server",
      }),
    );
    expect(result).toEqual(expect.objectContaining({ guid: "credential-123" }));
  });
});

describe("newConnectCredential OAuth path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stepControl.quickPickLabel = "API Key";
    mockCredentialsServiceList.mockResolvedValue([]);
    mockCredentialsServiceCreate.mockResolvedValue({
      guid: "credential-oauth",
      name: "connect.example.com",
      url: "https://connect.example.com",
      serverType: ServerType.CONNECT,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    stepControl.quickPickLabel = "API Key";
  });

  test("offers OAuth as an option and creates an OAuth credential when selected", async () => {
    // The auth-method QuickPick offers OAuth (Recommended); select it.
    stepControl.quickPickLabel = "OAuth (Recommended)";
    oauthStepperMocks.discoverOAuthMetadata.mockResolvedValue({
      token_endpoint: "https://connect.example.com/oauth/v1/token",
      authorization_endpoint: "https://connect.example.com/oauth/v1/authorize",
    });
    oauthStepperMocks.authenticate.mockResolvedValue({
      oauthClientId: "client-abc",
      accessToken: "at",
      refreshToken: "rt",
      tokenExpiresAt: "2099-01-01T00:00:00.000Z",
      userName: "publisher1",
    });
    const { inputCredentialNameStep } =
      await import("src/multiStepInputs/common");
    // Name defaults to the server hostname (like the token flow), not the
    // OAuth username.
    vi.mocked(inputCredentialNameStep).mockResolvedValue("connect.example.com");

    const result = await newConnectCredential(
      "test-view-id",
      "Create a New Credential",
      mockCredentialsService as unknown as import("src/credentials/service").CredentialsService,
      "https://connect.example.com",
    );

    expect(oauthStepperMocks.authenticate).toHaveBeenCalledTimes(1);
    expect(mockCredentialsServiceCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        oauthClientId: "client-abc",
        accessToken: "at",
        refreshToken: "rt",
        tokenExpiresAt: "2099-01-01T00:00:00.000Z",
        // No API key or token+privateKey on the OAuth path.
        apiKey: undefined,
        token: undefined,
        privateKey: undefined,
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({ guid: "credential-oauth" }),
    );
  });

  test("does not launch OAuth when the user picks API key on an OAuth-capable server", async () => {
    stepControl.quickPickLabel = "API Key";
    oauthStepperMocks.discoverOAuthMetadata.mockResolvedValue({
      token_endpoint: "https://connect.example.com/oauth/v1/token",
      authorization_endpoint: "https://connect.example.com/oauth/v1/authorize",
    });
    const { inputCredentialNameStep } =
      await import("src/multiStepInputs/common");
    vi.mocked(inputCredentialNameStep).mockResolvedValue("connect.example.com");

    await newConnectCredential(
      "test-view-id",
      "Create a New Credential",
      mockCredentialsService as unknown as import("src/credentials/service").CredentialsService,
      "https://connect.example.com",
    );

    expect(oauthStepperMocks.authenticate).not.toHaveBeenCalled();
    expect(mockCredentialsServiceCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: "mock-api-key-value",
        oauthClientId: undefined,
      }),
    );
  });

  test("falls back to the token/API-key flow when OAuth is unavailable", async () => {
    oauthStepperMocks.discoverOAuthMetadata.mockResolvedValue(null);
    const { inputCredentialNameStep } =
      await import("src/multiStepInputs/common");
    vi.mocked(inputCredentialNameStep).mockResolvedValue("My Server");

    await newConnectCredential(
      "test-view-id",
      "Create a New Credential",
      mockCredentialsService as unknown as import("src/credentials/service").CredentialsService,
      "https://connect.example.com",
    );

    expect(oauthStepperMocks.authenticate).not.toHaveBeenCalled();
    // The API-key path was taken (the QuickPick mock selects "API Key").
    expect(mockCredentialsServiceCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: "mock-api-key-value",
        oauthClientId: undefined,
      }),
    );
  });
});
