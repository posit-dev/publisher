// Copyright (C) 2024 by Posit Software, PBC.

import path from "node:path";

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { window } from "vscode";
import { DeploymentSelectorState } from "src/types/shared";
import {
  selectionStateFactory,
  preContentRecordFactory,
  configurationFactory,
  credentialFactory,
} from "src/test/unit-test-utils/factories";
import { mkExtensionContextStateMock } from "src/test/unit-test-utils/vscode-mocks";
import { LocalState } from "./constants";
import { PublisherState } from "./state";
import { AllContentRecordTypes, PreContentRecord } from "src/api";
import { ConfigurationLoadError } from "src/toml";
import { getInterpreterDefaults } from "src/interpreters";

class mockApiClient {}

const mockClient = new mockApiClient();

vi.mock("src/api", async (importOriginal) => {
  return {
    ...(await importOriginal<typeof import("src/api")>()),
    useApi: () => Promise.resolve(mockClient),
  };
});

vi.mock("src/utils/progress", () => {
  return {
    showProgress: vi.fn((_title, _view: string, until: () => Promise<void>) => {
      return until();
    }),
  };
});

vi.mock("src/utils/connectCloudHelpers", () => ({
  recordAddConnectCloudUrlParams: vi.fn(
    (record: AllContentRecordTypes, _ideName: string) => {
      return record;
    },
  ),
}));

// Mock the utils/vscode module since state.ts imports interpreter functions from it
vi.mock("src/utils/vscode", () => ({
  getPythonInterpreterPath: vi.fn(),
  getRInterpreterPath: vi.fn(),
}));

vi.mock("src/interpreters", () => ({
  getInterpreterDefaults: vi.fn(() =>
    Promise.resolve({
      python: { version: "", packageFile: "", packageManager: "" },
      preferredPythonPath: "",
      r: { version: "", packageFile: "", packageManager: "" },
      preferredRPath: "",
    }),
  ),
}));

const mockCredentialsServiceList = vi.fn();
const mockCredentialsServiceReset = vi.fn();
vi.mock("src/credentials/service", () => {
  return {
    CredentialsService: class {
      list = (...args: unknown[]) => mockCredentialsServiceList(...args);
      reset = (...args: unknown[]) => mockCredentialsServiceReset(...args);
    },
  };
});

const mockLoadConfiguration = vi.fn();
const mockLoadAllConfigurationsRecursive = vi.fn();
const mockLoadDeployment = vi.fn();
const mockLoadAllDeploymentsRecursive = vi.fn();

vi.mock("src/toml", async (importOriginal) => {
  return {
    ...(await importOriginal<typeof import("src/toml")>()),
    loadConfiguration: (...args: unknown[]) => mockLoadConfiguration(...args),
    loadAllConfigurationsRecursive: (...args: unknown[]) =>
      mockLoadAllConfigurationsRecursive(...args),
    loadDeployment: (...args: unknown[]) => mockLoadDeployment(...args),
    loadAllDeploymentsRecursive: (...args: unknown[]) =>
      mockLoadAllDeploymentsRecursive(...args),
  };
});

vi.mock("src/workspaces", () => ({
  path: () => "/workspace",
}));

vi.mock("vscode", () => {
  // mock Disposable
  const disposableMock = vi.fn();
  disposableMock.prototype.dispose = vi.fn();

  // mock window
  const windowMock = {
    showErrorMessage: vi.fn(),
    showWarningMessage: vi.fn(),
    showInformationMessage: vi.fn(),
    createOutputChannel: vi.fn(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    })),
  };

  const workspaceStateMock = {
    get: vi.fn(),
  };

  return {
    Disposable: disposableMock,
    window: windowMock,
    workspace: workspaceStateMock,
    EventEmitter: vi.fn(),
    env: {
      appName: "",
    },
    SecretStorage: vi.fn(),
  };
});

describe("PublisherState", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test("new instance", () => {
    const { mockContext } = mkExtensionContextStateMock({});
    const publisherState = new PublisherState(mockContext);
    expect(publisherState.contentRecords).toEqual([]);
    expect(publisherState.configurations).toEqual([]);
    expect(publisherState.credentials).toEqual([]);
  });

  test("get and update deployment selection", async () => {
    const newState: DeploymentSelectorState = selectionStateFactory.build();
    const { mockWorkspace, mockContext } = mkExtensionContextStateMock({});
    const publisherState = new PublisherState(mockContext);

    let currentSelection = publisherState.getSelection();
    expect(currentSelection).toEqual(undefined);
    expect(mockWorkspace.get).toHaveBeenCalledWith(
      LocalState.LastSelectionState,
      null,
    );

    await publisherState.updateSelection(newState);
    expect(mockWorkspace.update).toHaveBeenCalledWith(
      LocalState.LastSelectionState,
      newState,
    );

    currentSelection = publisherState.getSelection();
    expect(currentSelection).toEqual({
      projectDir: newState.projectDir,
      deploymentName: newState.deploymentName,
      deploymentPath: newState.deploymentPath,
    });
  });

  describe("getSelectedContentRecord", () => {
    test("finding records and cache handling", async () => {
      const initialState: DeploymentSelectorState =
        selectionStateFactory.build();
      const updatedState: DeploymentSelectorState =
        selectionStateFactory.build();

      const { mockContext } = mkExtensionContextStateMock({});
      const publisherState = new PublisherState(mockContext);

      let currentSelection = await publisherState.getSelectedContentRecord();
      expect(currentSelection).toEqual(undefined);
      expect(mockLoadDeployment).not.toHaveBeenCalled();

      // setup fake response from toml loader,
      // path must be the same between selection state and content record
      const firstGetResponseData: PreContentRecord =
        preContentRecordFactory.build({
          deploymentPath: initialState.deploymentPath,
        });
      mockLoadDeployment.mockResolvedValue(firstGetResponseData);

      // selection has something now
      await publisherState.updateSelection(initialState);

      currentSelection = await publisherState.getSelectedContentRecord();
      expect(mockLoadDeployment).toHaveBeenCalledTimes(1);
      expect(mockLoadDeployment).toHaveBeenCalledWith(
        initialState.deploymentName,
        initialState.projectDir,
        "/workspace",
      );
      expect(currentSelection).toEqual(firstGetResponseData);
      expect(publisherState.contentRecords).toEqual([firstGetResponseData]);

      // second time calls from cache
      currentSelection = await publisherState.getSelectedContentRecord();

      // Only the previous call is registered
      expect(mockLoadDeployment).toHaveBeenCalledTimes(1);
      expect(currentSelection).toEqual(firstGetResponseData);
      expect(publisherState.contentRecords).toEqual([firstGetResponseData]);

      // setup a second fake response from toml loader
      const secondGetResponseData: PreContentRecord =
        preContentRecordFactory.build();
      mockLoadDeployment.mockResolvedValue(secondGetResponseData);

      // selection has something different this time
      await publisherState.updateSelection(updatedState);

      // third time will get updated record
      currentSelection = await publisherState.getSelectedContentRecord();

      // Two load calls were triggered, each for every different selection
      expect(mockLoadDeployment).toHaveBeenCalledTimes(2);
      expect(currentSelection).toEqual(secondGetResponseData);

      // Cache now keeps the different records
      expect(publisherState.contentRecords).toEqual([
        firstGetResponseData,
        secondGetResponseData,
      ]);
    });

    describe("error responses from loading", () => {
      let publisherState: PublisherState;
      let initialState: DeploymentSelectorState;

      beforeEach(() => {
        initialState = selectionStateFactory.build();

        const { mockContext } = mkExtensionContextStateMock({});
        publisherState = new PublisherState(mockContext);

        // set an initial state so it tries to load from disk
        return publisherState.updateSelection(initialState);
      });

      test("ENOENT (missing file) is silently ignored", async () => {
        const enoentErr = Object.assign(
          new Error("ENOENT: no such file or directory"),
          { code: "ENOENT" },
        );
        mockLoadDeployment.mockRejectedValue(enoentErr);

        const currentSelection =
          await publisherState.getSelectedContentRecord();
        expect(mockLoadDeployment).toHaveBeenCalledTimes(1);
        expect(mockLoadDeployment).toHaveBeenCalledWith(
          initialState.deploymentName,
          initialState.projectDir,
          "/workspace",
        );

        // ENOENT errors are just ignored
        expect(currentSelection).toEqual(undefined);
        expect(publisherState.contentRecords).toEqual([]);
        expect(window.showInformationMessage).not.toHaveBeenCalled();
      });

      test("Other errors are shown", async () => {
        mockLoadDeployment.mockRejectedValue(new Error("unexpected error"));

        const currentSelection =
          await publisherState.getSelectedContentRecord();
        expect(mockLoadDeployment).toHaveBeenCalledTimes(1);
        expect(mockLoadDeployment).toHaveBeenCalledWith(
          initialState.deploymentName,
          initialState.projectDir,
          "/workspace",
        );

        // This error is propagated up now
        expect(currentSelection).toEqual(undefined);
        expect(publisherState.contentRecords).toEqual([]);
        expect(window.showInformationMessage).toHaveBeenCalledWith(
          "Unable to retrieve deployment record: unexpected error",
        );
      });
    });
  });

  describe("getSelectedConfiguration", () => {
    test("finding configuration and cache handling", async () => {
      const contentRecordState: DeploymentSelectorState =
        selectionStateFactory.build();

      const { mockContext, mockWorkspace } = mkExtensionContextStateMock({});
      const publisherState = new PublisherState(mockContext);

      // No config get due to no content record set
      let currentConfig = await publisherState.getSelectedConfiguration();
      expect(mockWorkspace.get).toHaveBeenCalled();
      expect(currentConfig).toEqual(undefined);
      expect(mockLoadConfiguration).not.toHaveBeenCalled();

      // setup existing content record in cache
      const contentRecord = preContentRecordFactory.build({
        deploymentPath: contentRecordState.deploymentPath,
      });
      publisherState.contentRecords.push(contentRecord);

      // setup fake config from toml loader,
      // config name and project dir must be the same between content record and config
      const config = configurationFactory.build({
        configurationName: contentRecord.configurationName,
        projectDir: contentRecord.projectDir,
      });
      mockLoadConfiguration.mockResolvedValue(config);

      // selection has something now
      await publisherState.updateSelection(contentRecordState);

      currentConfig = await publisherState.getSelectedConfiguration();
      expect(mockLoadConfiguration).toHaveBeenCalledTimes(1);
      expect(currentConfig).toEqual(config);
      expect(publisherState.configurations).toEqual([config]);

      // getInterpreterDefaults should receive absolute path (workspace root + projectDir)
      expect(vi.mocked(getInterpreterDefaults)).toHaveBeenCalledWith(
        path.join("/workspace", contentRecord.projectDir),
        undefined,
        undefined,
      );

      // second time calls from cache
      currentConfig = await publisherState.getSelectedConfiguration();

      // Only the previous call is registered
      expect(mockLoadConfiguration).toHaveBeenCalledTimes(1);
      expect(currentConfig).toEqual(config);
      expect(publisherState.configurations).toEqual([config]);

      // setup a second content record in cache and its respective config
      const secondContentRecordState: DeploymentSelectorState =
        selectionStateFactory.build();
      const secondContentRecord = preContentRecordFactory.build({
        deploymentPath: secondContentRecordState.deploymentPath,
      });
      publisherState.contentRecords.push(secondContentRecord);

      const secondConfig = configurationFactory.build({
        configurationName: secondContentRecord.configurationName,
        projectDir: secondContentRecord.projectDir,
      });
      mockLoadConfiguration.mockResolvedValue(secondConfig);

      // selection has something different this time
      await publisherState.updateSelection(secondContentRecordState);

      // third time will get a new configuration
      currentConfig = await publisherState.getSelectedConfiguration();

      // Two calls were triggered, each for every different
      expect(mockLoadConfiguration).toHaveBeenCalledTimes(2);
      expect(currentConfig).toEqual(secondConfig);
      expect(publisherState.configurations).toEqual([config, secondConfig]);
    });

    describe("error responses", () => {
      let publisherState: PublisherState;
      let contentRecordState: DeploymentSelectorState;

      beforeEach(() => {
        contentRecordState = selectionStateFactory.build();

        const { mockContext } = mkExtensionContextStateMock({});
        publisherState = new PublisherState(mockContext);

        // setup existing content record in cache
        const contentRecord = preContentRecordFactory.build({
          deploymentPath: contentRecordState.deploymentPath,
        });
        publisherState.contentRecords.push(contentRecord);

        // set an initial state so it tries to load config
        return publisherState.updateSelection(contentRecordState);
      });

      test("ENOENT (missing file) is silently ignored", async () => {
        const enoentErr = Object.assign(
          new Error("ENOENT: no such file or directory"),
          { code: "ENOENT" },
        );
        mockLoadConfiguration.mockRejectedValue(enoentErr);

        const currentConfig = await publisherState.getSelectedConfiguration();

        expect(currentConfig).toEqual(undefined);
        expect(publisherState.configurations).toEqual([]);
        expect(window.showInformationMessage).not.toHaveBeenCalled();
      });

      test("ConfigurationLoadError (invalid file) is silently ignored", async () => {
        const loadErr = new ConfigurationLoadError({
          error: {
            code: "invalidTOML",
            msg: "bad toml",
            operation: "test",
            data: {},
          },
          configurationName: "test",
          configurationPath: "/test",
          projectDir: "/test",
        });
        mockLoadConfiguration.mockRejectedValue(loadErr);

        const currentConfig = await publisherState.getSelectedConfiguration();

        expect(currentConfig).toEqual(undefined);
        expect(publisherState.configurations).toEqual([]);
        expect(window.showInformationMessage).not.toHaveBeenCalled();
      });

      test("Other errors are shown", async () => {
        mockLoadConfiguration.mockRejectedValue(new Error("unexpected error"));

        const currentConfig = await publisherState.getSelectedConfiguration();

        expect(currentConfig).toEqual(undefined);
        expect(publisherState.configurations).toEqual([]);
        expect(window.showInformationMessage).toHaveBeenCalledWith(
          "Unable to retrieve deployment configuration: unexpected error",
        );
      });
    });
  });

  describe("refreshCredentials", () => {
    test("Calls to fetch credentials and stores to state", async () => {
      const fakeCredsFetch = credentialFactory.buildList(3);
      mockCredentialsServiceList.mockResolvedValue(fakeCredsFetch);

      const { mockContext } = mkExtensionContextStateMock({});
      const publisherState = new PublisherState(mockContext);

      // Creds are empty initially
      expect(publisherState.credentials).toEqual([]);

      // Populated with service results
      await publisherState.refreshCredentials();
      expect(publisherState.credentials).toEqual(fakeCredsFetch);
    });

    test("uses CredentialsService.list() instead of Go API", async () => {
      const fakeCredsFetch = credentialFactory.buildList(2);
      mockCredentialsServiceList.mockResolvedValue(fakeCredsFetch);

      const { mockContext } = mkExtensionContextStateMock({});
      const publisherState = new PublisherState(mockContext);

      await publisherState.refreshCredentials();
      expect(mockCredentialsServiceList).toHaveBeenCalled();
    });

    describe("errors", () => {
      test("service error - shows error message", async () => {
        mockCredentialsServiceList.mockRejectedValueOnce(
          new Error("storage failure"),
        );

        const { mockContext } = mkExtensionContextStateMock({});
        const publisherState = new PublisherState(mockContext);

        // Creds are empty initially
        expect(publisherState.credentials).toEqual([]);

        // Creds are still empty
        await publisherState.refreshCredentials();
        expect(publisherState.credentials).toEqual([]);

        // Error message is processed
        expect(window.showErrorMessage).toHaveBeenCalledWith("storage failure");
      });
    });
  });

  describe("resetCredentials", () => {
    test("calls to reset credentials and shows a warning", async () => {
      mockCredentialsServiceReset.mockResolvedValue(undefined);

      const { mockContext } = mkExtensionContextStateMock({});
      const publisherState = new PublisherState(mockContext);

      publisherState.credentials = credentialFactory.buildList(3);
      await publisherState.resetCredentials();

      expect(publisherState.credentials).toEqual([]);

      // Warning message is called
      expect(window.showWarningMessage).toHaveBeenCalledWith(
        "Credentials have been reset.",
      );
    });

    test("uses CredentialsService.reset() instead of Go API", async () => {
      mockCredentialsServiceReset.mockResolvedValue(undefined);

      const { mockContext } = mkExtensionContextStateMock({});
      const publisherState = new PublisherState(mockContext);

      await publisherState.resetCredentials();
      expect(mockCredentialsServiceReset).toHaveBeenCalled();
    });

    test("on service error - shows message", async () => {
      mockCredentialsServiceReset.mockRejectedValueOnce(
        new Error("terrible, could not reset"),
      );

      const { mockContext } = mkExtensionContextStateMock({});
      const publisherState = new PublisherState(mockContext);

      await publisherState.resetCredentials();
      expect(window.showErrorMessage).toHaveBeenCalledWith(
        "terrible, could not reset",
      );
    });
  });

  test.todo("getSelectedConfiguration", () => {});

  test.todo("refreshContentRecords", () => {});

  test("refreshConfigurations passes absolute workspace root to getInterpreterDefaults", async () => {
    const { mockContext } = mkExtensionContextStateMock({});
    const publisherState = new PublisherState(mockContext);

    mockLoadAllConfigurationsRecursive.mockResolvedValue([]);
    vi.mocked(getInterpreterDefaults).mockClear();

    await publisherState.refreshConfigurations();

    expect(vi.mocked(getInterpreterDefaults)).toHaveBeenCalledWith(
      "/workspace",
      undefined,
      undefined,
    );
  });

  test.todo("validConfigs", () => {});

  test.todo("configsInError", () => {});
});
