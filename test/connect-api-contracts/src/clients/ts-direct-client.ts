// Copyright (C) 2026 by Posit Software, PBC.

import {
  ConnectAPI,
  type ContentID,
  type BundleID,
  type TaskID,
} from "@posit-dev/connect-api";

import type {
  ConnectContractClient,
  ConnectContractResult,
  ConnectContractStatus,
  MethodName,
} from "../client";
import { Method } from "../client";
import type { CapturedRequest } from "../mock-connect-server";

/**
 * Thin adapter that wraps the production ConnectAPI for contract testing.
 * Handles mock server request capture and maps return values to the
 * contract result shapes ({ contentId }, { bundleId }, etc.).
 */
export class TypeScriptDirectClient implements ConnectContractClient {
  private readonly connectClient: ConnectAPI;

  constructor(
    private connectUrl: string,
    apiKey: string,
  ) {
    this.connectClient = new ConnectAPI({ url: connectUrl, apiKey });
  }

  async call(
    method: MethodName,
    params?: Record<string, unknown>,
  ): Promise<ConnectContractResult> {
    // Clear captured requests before the call
    await this.clearCapturedRequests();

    let result: unknown = undefined;
    let status: ConnectContractStatus = "success";

    try {
      result = await this.dispatch(method, params ?? {});
    } catch (err) {
      status = "error";
      // For testAuthentication, the error carries a structured result
      if (method === Method.TestAuthentication && err instanceof Error) {
        const msg = err.message;
        result = { user: null, error: { msg } };
      }
    }

    // Fetch captured requests after the call
    const capturedRequests = await this.fetchCapturedRequests();

    return {
      status,
      result,
      capturedRequest: capturedRequests.length > 0 ? capturedRequests[0] : null,
      capturedRequests,
    };
  }

  private async dispatch(
    method: MethodName,
    params: Record<string, unknown>,
  ): Promise<unknown> {
    const c = this.connectClient;

    switch (method) {
      case Method.TestAuthentication:
        return c.testAuthentication();

      case Method.GetCurrentUser:
        return c.getCurrentUser();

      case Method.ContentDetails:
        return c.contentDetails(params.contentId as ContentID);

      case Method.CreateDeployment: {
        const content = await c.createDeployment(
          (params.body as Record<string, unknown>) ?? {},
        );
        return { contentId: content.guid };
      }

      case Method.UpdateDeployment:
        await c.updateDeployment(
          params.contentId as ContentID,
          (params.body as Record<string, unknown>) ?? {},
        );
        return undefined;

      case Method.GetEnvVars:
        return c.getEnvVars(params.contentId as ContentID);

      case Method.SetEnvVars:
        await c.setEnvVars(
          params.contentId as ContentID,
          params.env as Record<string, string>,
        );
        return undefined;

      case Method.UploadBundle: {
        const bundle = await c.uploadBundle(
          params.contentId as ContentID,
          params.bundleData as Uint8Array,
        );
        return { bundleId: bundle.id };
      }

      case Method.LatestBundleID: {
        const content = await c.latestBundleId(params.contentId as ContentID);
        return { bundleId: content.bundle_id };
      }

      case Method.DownloadBundle:
        return c.downloadBundle(
          params.contentId as ContentID,
          params.bundleId as BundleID,
        );

      case Method.DeployBundle: {
        const deploy = await c.deployBundle(
          params.contentId as ContentID,
          params.bundleId as BundleID,
        );
        return { taskId: deploy.task_id };
      }

      case Method.WaitForTask:
        return c.waitForTask(params.taskId as TaskID, 0);

      case Method.ValidateDeployment:
        await c.validateDeployment(params.contentId as ContentID);
        return undefined;

      case Method.GetIntegrations:
        return c.getIntegrations();

      case Method.GetSettings:
        return c.getSettings();

      default:
        throw new Error(`Unknown method: ${method}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Mock server test infrastructure
  // ---------------------------------------------------------------------------

  private async clearCapturedRequests(): Promise<void> {
    await fetch(`${this.connectUrl}/__test__/requests`, { method: "DELETE" });
  }

  private async fetchCapturedRequests(): Promise<CapturedRequest[]> {
    const resp = await fetch(`${this.connectUrl}/__test__/requests`);
    return resp.json() as Promise<CapturedRequest[]>;
  }
}
