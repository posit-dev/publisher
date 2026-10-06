// Copyright (C) 2026 by Posit Software, PBC.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConnectAPI } from "@posit-dev/connect-api";
import { AxiosHeaders } from "axios";
import { window } from "vscode";
import {
  fetchConnectSessionTitle,
  isConnectSessionTarget,
  validateConnectSessionDeploy,
} from "./connectSessionDeployment";

vi.mock("vscode", () => ({
  window: {
    showWarningMessage: vi.fn(),
    showErrorMessage: vi.fn(),
  },
}));

const api = new ConnectAPI({ url: "https://connect.example.com" });
const content = {
  guid: "source-guid",
  name: "source-name",
  title: "Source app",
  description: "",
  access_type: "acl",
  connection_timeout: null,
  read_timeout: null,
  init_timeout: null,
  idle_timeout: null,
  max_processes: null,
  min_processes: null,
  max_conns_per_process: null,
  load_factor: null,
  created_time: "",
  last_deployed_time: "",
  bundle_id: "bundle-2",
  app_mode: "python-shiny",
  content_category: "",
  parameterized: false,
  cluster_name: null,
  image_name: null,
  r_version: null,
  py_version: null,
  quarto_version: null,
  run_as: null,
  run_as_current_user: false,
  owner_guid: "owner-guid",
  content_url: "",
  dashboard_url: "",
  locked: false,
  app_role: "editor",
  id: "1",
};

describe("Connect session deployment", () => {
  beforeEach(() => {
    vi.stubEnv("POSIT_PRODUCT", "CONNECT");
    vi.stubEnv("CONNECT_SERVER", "https://connect.example.com");
    vi.stubEnv("CONNECT_DEPLOY_TARGET_GUID", "source-guid");
    vi.stubEnv("CONNECT_CONTENT_GUID", "project-guid");
    vi.stubEnv("CONNECT_DEPLOY_TARGET_BUNDLE_ID", "bundle-2");
    vi.clearAllMocks();
    vi.spyOn(api, "contentDetails").mockResolvedValue({
      data: content,
      status: 200,
      statusText: "OK",
      headers: {},
      config: { headers: new AxiosHeaders() },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("matches only the linked source on the session server", () => {
    expect(
      isConnectSessionTarget("https://connect.example.com/", "source-guid"),
    ).toBe(true);
    expect(
      isConnectSessionTarget("https://other.example.com", "source-guid"),
    ).toBe(false);
    expect(
      isConnectSessionTarget("https://connect.example.com", "project-guid"),
    ).toBe(false);
    expect(
      isConnectSessionTarget("https://connect.example.com", undefined),
    ).toBe(false);
    vi.stubEnv("CONNECT_SERVER", "https://CONNECT.example.com//team/./");
    expect(
      isConnectSessionTarget("https://connect.example.com/team", "source-guid"),
    ).toBe(true);
    vi.stubEnv("CONNECT_SERVER", undefined);
    expect(
      isConnectSessionTarget("https://different.example.com", "source-guid"),
    ).toBe(true);
    expect(
      isConnectSessionTarget("https://different.example.com", "other-guid"),
    ).toBe(false);
    vi.stubEnv("CONNECT_SERVER", "not a URL");
    expect(
      isConnectSessionTarget("https://connect.example.com", "source-guid"),
    ).toBe(true);
    vi.stubEnv("CONNECT_SERVER", "https://connect.example.com");
    vi.stubEnv("POSIT_PRODUCT", "");
    expect(
      isConnectSessionTarget("https://connect.example.com", "source-guid"),
    ).toBe(false);
  });

  it("fetches the source title for UI display", async () => {
    expect(await fetchConnectSessionTitle(api, "source-guid")).toBe(
      "Source app",
    );
    expect(api.contentDetails).toHaveBeenCalledWith("source-guid");
  });

  it("falls back to the Connect content name when its title is empty", async () => {
    vi.mocked(api.contentDetails).mockResolvedValueOnce({
      data: { ...content, title: "" },
      status: 200,
      statusText: "OK",
      headers: {},
      config: { headers: new AxiosHeaders() },
    });

    expect(await fetchConnectSessionTitle(api, "source-guid")).toBe(
      "source-name",
    );
  });

  it("accepts the Connect owner role", async () => {
    vi.mocked(api.contentDetails).mockResolvedValueOnce({
      data: { ...content, app_role: "owner" },
      status: 200,
      statusText: "OK",
      headers: {},
      config: { headers: new AxiosHeaders() },
    });

    expect(await validateConnectSessionDeploy(api, "source-guid")).toBe(true);
  });

  it("accepts the Connect editor role without prompting for confirmation", async () => {
    expect(await validateConnectSessionDeploy(api, "source-guid")).toBe(true);
    expect(api.contentDetails).toHaveBeenCalledWith("source-guid");
    expect(window.showWarningMessage).not.toHaveBeenCalled();
  });

  it("warns non-blockingly when the baseline bundle is missing or stale", async () => {
    vi.mocked(window.showWarningMessage).mockImplementation(
      () => new Promise(() => {}),
    );
    vi.stubEnv("CONNECT_DEPLOY_TARGET_BUNDLE_ID", "");
    expect(await validateConnectSessionDeploy(api, "source-guid")).toBe(true);
    expect(window.showWarningMessage).toHaveBeenCalledWith(
      expect.stringContaining("bundle ID was unavailable"),
    );

    vi.stubEnv("CONNECT_DEPLOY_TARGET_BUNDLE_ID", "bundle-1");
    expect(await validateConnectSessionDeploy(api, "source-guid")).toBe(true);
    expect(window.showWarningMessage).toHaveBeenLastCalledWith(
      expect.stringContaining("source has changed"),
    );

    vi.stubEnv("CONNECT_DEPLOY_TARGET_BUNDLE_ID", "bundle-2");
    expect(await validateConnectSessionDeploy(api, "source-guid")).toBe(true);
    expect(window.showWarningMessage).toHaveBeenCalledTimes(2);
  });

  it("blocks inaccessible and locked sources without a deploy prompt", async () => {
    vi.mocked(api.contentDetails).mockRejectedValueOnce(new Error("Forbidden"));
    expect(await validateConnectSessionDeploy(api, "source-guid")).toBe(false);
    expect(window.showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining("editor access"),
    );
    vi.mocked(api.contentDetails).mockResolvedValueOnce({
      data: { ...content, locked: true },
      status: 200,
      statusText: "OK",
      headers: {},
      config: { headers: new AxiosHeaders() },
    });
    expect(await validateConnectSessionDeploy(api, "source-guid")).toBe(false);
    expect(window.showErrorMessage).toHaveBeenLastCalledWith(
      expect.stringContaining("locked"),
    );
    vi.mocked(api.contentDetails).mockResolvedValueOnce({
      data: { ...content, app_role: "viewer" },
      status: 200,
      statusText: "OK",
      headers: {},
      config: { headers: new AxiosHeaders() },
    });
    expect(await validateConnectSessionDeploy(api, "source-guid")).toBe(false);
    expect(window.showErrorMessage).toHaveBeenLastCalledWith(
      expect.stringContaining("owner or editor"),
    );
    expect(window.showWarningMessage).not.toHaveBeenCalled();
  });
});
