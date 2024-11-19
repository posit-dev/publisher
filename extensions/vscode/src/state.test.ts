// Copyright (C) 2024 by Posit Software, PBC.

import { afterEach, describe, expect, test, vi } from "vitest";
import { window } from "vscode";
import { AxiosError, AxiosHeaders } from "axios";
import { DeploymentSelectorState } from "src/types/shared";
import {
  selectionStateFactory,
  preContentRecordFactory,
  configurationFactory,
} from "src/test/unit-test-utils/factories";
import { mkExtensionContextStateMock } from "src/test/unit-test-utils/vscode-mocks";
import { LocalState } from "./constants";
import { PublisherState } from "./state";
import { PreContentRecord } from "src/api";

class mockApiClient {
  readonly contentRecords = {
    get: vi.fn(),
    getAll: vi.fn(),
  };

  readonly configurations = {
    get: vi.fn(),
    getAll: vi.fn(),
  };

  readonly credentials = {
    list: vi.fn(),
  };
}

const mockClient = new mockApiClient();

vi.mock("src/api", async (importOriginal) => {
  return {
    ...(await importOriginal<typeof import("src/api")>()),
    useApi: () => Promise.resolve(mockClient),
  };
});

vi.mock("vscode", () => {
  // mock Disposable
  const disposableMock = vi.fn();
  disposableMock.prototype.dispose = vi.fn();

  // mock window
  const windowMock = {
    showErrorMessage: vi.fn(),
    showInformationMessage: vi.fn(),
  };

  return {
    Disposable: disposableMock,
    window: windowMock,
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
      expect(mockClient.contentRecords.get).not.toHaveBeenCalled();

      // setup fake response from api client, note path must be the same between selection state and content record
      const firstGetResponseData: PreContentRecord =
        preContentRecordFactory.build({
          deploymentPath: initialState.deploymentPath,
        });
      mockClient.contentRecords.get.mockResolvedValue({
        data: firstGetResponseData,
      });

      // selection has something now
      await publisherState.updateSelection(initialState);

      currentSelection = await publisherState.getSelectedContentRecord();
      expect(mockClient.contentRecords.get).toHaveBeenCalledTimes(1);
      expect(mockClient.contentRecords.get).toHaveBeenCalledWith(
        initialState.deploymentName,
        initialState.projectDir,
      );
      expect(currentSelection).toEqual(firstGetResponseData);
      expect(publisherState.contentRecords).toEqual([firstGetResponseData]);

      // second time calls from cache
      currentSelection = await publisherState.getSelectedContentRecord();

      // Only the previous call is registered
      expect(mockClient.contentRecords.get).toHaveBeenCalledTimes(1);
      expect(currentSelection).toEqual(firstGetResponseData);
      expect(publisherState.contentRecords).toEqual([firstGetResponseData]);

      // setup a second fake response from api client
      const secondGetResponseData: PreContentRecord =
        preContentRecordFactory.build();
      mockClient.contentRecords.get.mockResolvedValue({
        data: secondGetResponseData,
      });

      // selection has something different this time
      await publisherState.updateSelection(updatedState);

      // third time will get updated record
      currentSelection = await publisherState.getSelectedContentRecord();

      // Two API calls were triggered, each for every different
      expect(mockClient.contentRecords.get).toHaveBeenCalledTimes(2);
      expect(currentSelection).toEqual(secondGetResponseData);

      // Cache now keeps the different records
      expect(publisherState.contentRecords).toEqual([
        firstGetResponseData,
        secondGetResponseData,
      ]);
    });

    test("error responses from API", async () => {
      const initialState: DeploymentSelectorState =
        selectionStateFactory.build();

      const { mockContext } = mkExtensionContextStateMock({});
      const publisherState = new PublisherState(mockContext);

      // setup fake 404 error from api client
      const axiosErr = new AxiosError();
      axiosErr.response = {
        data: "",
        status: 404,
        statusText: "404",
        headers: {},
        config: { headers: new AxiosHeaders() },
      };
      mockClient.contentRecords.get.mockRejectedValue(axiosErr);

      // set an initial state so it tries to pull from API
      await publisherState.updateSelection(initialState);

      let currentSelection = await publisherState.getSelectedContentRecord();
      expect(mockClient.contentRecords.get).toHaveBeenCalledTimes(1);
      expect(mockClient.contentRecords.get).toHaveBeenCalledWith(
        initialState.deploymentName,
        initialState.projectDir,
      );

      // 404 errors are just ignored
      expect(currentSelection).toEqual(undefined);
      expect(publisherState.contentRecords).toEqual([]);
      expect(window.showInformationMessage).not.toHaveBeenCalled();

      // NOT 404 errors are shown
      axiosErr.response = {
        data: "custom test error",
        status: 401,
        statusText: "401",
        headers: {},
        config: { headers: new AxiosHeaders() },
      };
      mockClient.contentRecords.get.mockRejectedValue(axiosErr);

      currentSelection = await publisherState.getSelectedContentRecord();
      expect(mockClient.contentRecords.get).toHaveBeenCalledTimes(2);
      expect(mockClient.contentRecords.get).toHaveBeenCalledWith(
        initialState.deploymentName,
        initialState.projectDir,
      );

      // This error is propagated up now
      expect(currentSelection).toEqual(undefined);
      expect(publisherState.contentRecords).toEqual([]);
      expect(window.showInformationMessage).toHaveBeenCalledWith(
        "Unable to retrieve deployment record: custom test error",
      );
    });
  });

  describe("getSelectedConfiguration", () => {
    test("finding configuration and cache handling", async () => {
      const contentRecordState: DeploymentSelectorState =
        selectionStateFactory.build();

      const { mockContext } = mkExtensionContextStateMock({});
      const publisherState = new PublisherState(mockContext);

      // No config get due to no content record set
      let currentConfig = await publisherState.getSelectedConfiguration();
      expect(currentConfig).toEqual(undefined);
      expect(mockClient.configurations.get).not.toHaveBeenCalled();

      // setup existing content record in cache
      const contentRecord = preContentRecordFactory.build({
        deploymentPath: contentRecordState.deploymentPath,
      });
      publisherState.contentRecords.push(contentRecord);

      // setup fake config API response, note config name and project dir must be the same between content record and config
      const config = configurationFactory.build({
        configurationName: contentRecord.configurationName,
        projectDir: contentRecord.projectDir,
      });
      mockClient.configurations.get.mockResolvedValue({
        data: config,
      });

      // selection has something now
      await publisherState.updateSelection(contentRecordState);

      currentConfig = await publisherState.getSelectedConfiguration();
      expect(mockClient.configurations.get).toHaveBeenCalledTimes(1);
      expect(mockClient.configurations.get).toHaveBeenCalledWith(
        contentRecord.configurationName,
        contentRecord.projectDir,
      );
      expect(currentConfig).toEqual(config);
      expect(publisherState.configurations).toEqual([config]);

      // second time calls from cache
      currentConfig = await publisherState.getSelectedConfiguration();

      // Only the previous call is registered
      expect(mockClient.configurations.get).toHaveBeenCalledTimes(1);
      expect(currentConfig).toEqual(config);
      expect(publisherState.configurations).toEqual([config]);

      // setup a second content record in cache and it's respective config API response
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
      mockClient.configurations.get.mockResolvedValue({
        data: secondConfig,
      });

      // selection has something different this time
      await publisherState.updateSelection(secondContentRecordState);

      // third time will get a new configuration
      currentConfig = await publisherState.getSelectedConfiguration();

      // Two API calls were triggered, each for every different
      expect(mockClient.configurations.get).toHaveBeenCalledTimes(2);
      expect(currentConfig).toEqual(secondConfig);
      expect(publisherState.configurations).toEqual([config, secondConfig]);
    });

    test("error responses from API", async () => {
      const contentRecordState: DeploymentSelectorState =
        selectionStateFactory.build();

      const { mockContext } = mkExtensionContextStateMock({});
      const publisherState = new PublisherState(mockContext);

      // setup existing content record in cache
      const contentRecord = preContentRecordFactory.build({
        deploymentPath: contentRecordState.deploymentPath,
      });
      publisherState.contentRecords.push(contentRecord);

      // setup fake 404 error from api client
      const axiosErr = new AxiosError();
      axiosErr.response = {
        data: "",
        status: 404,
        statusText: "404",
        headers: {},
        config: { headers: new AxiosHeaders() },
      };
      mockClient.configurations.get.mockRejectedValue(axiosErr);

      // set an initial state so it tries to pull from API
      await publisherState.updateSelection(contentRecordState);

      let currentConfig = await publisherState.getSelectedConfiguration();
      expect(mockClient.configurations.get).toHaveBeenCalledTimes(1);
      expect(mockClient.configurations.get).toHaveBeenCalledWith(
        contentRecord.configurationName,
        contentRecord.projectDir,
      );

      // 404 errors are just ignored
      expect(currentConfig).toEqual(undefined);
      expect(publisherState.configurations).toEqual([]);
      expect(window.showInformationMessage).not.toHaveBeenCalled();

      // NOT 404 errors are shown
      axiosErr.response = {
        data: "custom test error",
        status: 401,
        statusText: "401",
        headers: {},
        config: { headers: new AxiosHeaders() },
      };
      mockClient.contentRecords.get.mockRejectedValue(axiosErr);

      currentConfig = await publisherState.getSelectedConfiguration();
      expect(mockClient.configurations.get).toHaveBeenCalledTimes(2);
      expect(mockClient.configurations.get).toHaveBeenCalledWith(
        contentRecord.configurationName,
        contentRecord.projectDir,
      );

      // This error is propagated up now
      expect(currentConfig).toEqual(undefined);
      expect(publisherState.configurations).toEqual([]);
      expect(window.showInformationMessage).toHaveBeenCalledWith(
        "Unable to retrieve deployment configuration: custom test error",
      );
    });
  });

  test.todo("getSelectedConfiguration", () => {});

  test.todo("refreshContentRecords", () => {});

  test.todo("refreshConfigurations", () => {});

  test.todo("validConfigs", () => {});

  test.todo("configsInError", () => {});

  test.todo("refreshCredentials", () => {});
});
