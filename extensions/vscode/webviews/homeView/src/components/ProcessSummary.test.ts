// Copyright (C) 2026 by Posit Software, PBC.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { reactive } from "vue";
import { shallowMount } from "@vue/test-utils";
import {
  ContentRecordState,
  ServerType,
  ProductType,
} from "../../../../src/api/types/contentRecords";
import type { ContentID, BundleID } from "@posit-dev/connect-api";
import { ContentType } from "../../../../src/api/types/configurations";
import type { AllContentRecordTypes } from "../../../../src/api/types/contentRecords";
import ProcessSummary from "./ProcessSummary.vue";

// Mock the home store with reactive state we can control per-test.
const homeState = reactive({
  selectedContentRecord: undefined as AllContentRecordTypes | undefined,
  publishInProgress: false,
  contentRenderSuccess: undefined as string | undefined,
  contentRenderError: undefined as string | undefined,
});

vi.mock("src/stores/home", () => ({
  useHomeStore: () => homeState,
}));

vi.mock("src/HostConduitService", () => ({
  useHostConduitService: () => ({ sendMsg: vi.fn() }),
}));

function resetState() {
  homeState.selectedContentRecord = undefined;
  homeState.publishInProgress = false;
  homeState.contentRenderSuccess = undefined;
  homeState.contentRenderError = undefined;
}

/** Minimal content record location fields. */
const location = {
  deploymentName: "test",
  deploymentPath: "/test/.posit/publish/deployments/test.toml",
  projectDir: "/test",
};

/** Fields required by the Configuration intersection on ContentRecord. */
const configFields = {
  configurationName: "production",
  configurationPath: "/test/.posit/publish/production.toml",
  configuration: {
    $schema:
      "https://cdn.posit.co/publisher/schemas/posit-publishing-schema-v3.json" as const,
    type: ContentType.PYTHON_SHINY,
    productType: ProductType.CONNECT,
    entrypoint: "app.py",
    validate: false,
  },
};

describe("ProcessSummary", () => {
  beforeEach(resetState);

  it("renders deployment error message from DeploymentRecordError", () => {
    homeState.selectedContentRecord = {
      $schema: "",
      serverType: ServerType.CONNECT,
      serverUrl: "https://connect.example.com",
      createdAt: "2024-01-01T00:00:00Z",
      dismissedAt: "",
      configurationName: "production",
      type: ContentType.PYTHON_SHINY,
      state: ContentRecordState.NEW,
      connectCloud: null,
      deploymentError: {
        code: "deployFailed",
        message: "Build failed: missing package numpy",
        operation: "publish",
      },
      ...location,
    };

    const wrapper = shallowMount(ProcessSummary);

    // Title should say "Last Deployment Failed"
    expect(wrapper.text()).toContain("Last Deployment Failed");

    // TextStringWithAnchor should receive the error message
    const anchor = wrapper.findComponent({ name: "TextStringWithAnchor" });
    expect(anchor.exists()).toBe(true);
    expect(anchor.props("message")).toBe("Build failed: missing package numpy");
  });

  it("shows 'View Deployment Logs' for deployedContentNotRunning error", () => {
    homeState.selectedContentRecord = {
      $schema: "",
      serverType: ServerType.CONNECT,
      serverUrl: "https://connect.example.com",
      createdAt: "2024-01-01T00:00:00Z",
      dismissedAt: "",
      type: ContentType.PYTHON_SHINY,
      state: ContentRecordState.DEPLOYED,
      id: "abc-123" as ContentID,
      bundleId: "456" as BundleID,
      bundleUrl:
        "https://connect.example.com/__api__/v1/content/abc-123/bundles/456/download",
      dashboardUrl: "https://connect.example.com/connect/#/apps/abc-123",
      directUrl: "https://connect.example.com/content/abc-123/",
      logsUrl: "https://connect.example.com/connect/#/apps/abc-123/logs",
      files: [],
      deployedAt: "2024-01-01T00:00:00Z",
      connectCloud: null,
      deploymentError: {
        code: "deployedContentNotRunning",
        message: "Content is not running",
        operation: "publish",
      },
      ...location,
      ...configFields,
    };

    const wrapper = shallowMount(ProcessSummary);

    // Button should say "View Deployment Logs" (not "View Content")
    const button = wrapper.find("vscode-button");
    expect(button.exists()).toBe(true);
    expect(button.text()).toBe("View Deployment Logs");
  });

  it("shows 'View Content' when no deployment error", () => {
    homeState.selectedContentRecord = {
      $schema: "",
      serverType: ServerType.CONNECT,
      serverUrl: "https://connect.example.com",
      createdAt: "2024-01-01T00:00:00Z",
      dismissedAt: "",
      type: ContentType.PYTHON_SHINY,
      state: ContentRecordState.DEPLOYED,
      id: "abc-123" as ContentID,
      bundleId: "456" as BundleID,
      bundleUrl:
        "https://connect.example.com/__api__/v1/content/abc-123/bundles/456/download",
      dashboardUrl: "https://connect.example.com/connect/#/apps/abc-123",
      directUrl: "https://connect.example.com/content/abc-123/",
      logsUrl: "https://connect.example.com/connect/#/apps/abc-123/logs",
      files: [],
      deployedAt: "2024-01-01T00:00:00Z",
      connectCloud: null,
      deploymentError: null,
      ...location,
      ...configFields,
    };

    const wrapper = shallowMount(ProcessSummary);

    const button = wrapper.find("vscode-button");
    expect(button.exists()).toBe(true);
    expect(button.text()).toBe("View Content");
  });
});
