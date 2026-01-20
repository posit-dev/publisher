// Copyright (C) 2025 by Posit Software, PBC.

import { window, Uri, env } from "vscode";
import { useApi } from "src/api";
import { logger } from "src/logging";
import { getMessageFromError } from "src/utils/errors";
import { showProgress } from "src/utils/progress";

export interface TokenAuthResult {
  token: string;
  privateKey: string;
  userName: string;
  serverUrl: string;
}

export interface TokenAuthError {
  message: string;
  error: unknown;
}

export class ConnectAuthTokenActivator {
  private readonly serverUrl: string;
  private readonly viewId: string;
  private readonly maxAttempts: number;
  private api: Awaited<ReturnType<typeof useApi>> | null = null;

  constructor(serverUrl: string, viewId: string, maxAttempts: number = 60) {
    this.serverUrl = serverUrl;
    this.viewId = viewId;
    // default: 60 = 30 seconds with 500ms between attempts
    this.maxAttempts = maxAttempts;
  }

  async initialize(): Promise<void> {
    this.api = await useApi();
  }

  private ensureInitialized(): void {
    if (!this.api) {
      throw new Error(
        "ConnectAuthTokenActivator must be initialized before use",
      );
    }
  }

  async activateToken(): Promise<TokenAuthResult> {
    try {
      // Step 1: Generate token
      const { token, claimUrl, privateKey, serverUrl } =
        await this.generateToken();

      // Step 2: Open browser for token claim
      await this.openTokenClaimUrl(claimUrl);

      // Step 3: Poll for token verification using discovered URL
      const userName = await this.pollForTokenClaim(
        token,
        privateKey,
        serverUrl,
      );

      return { token, privateKey, userName, serverUrl };
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  private async generateToken(): Promise<{
    token: string;
    claimUrl: string;
    privateKey: string;
    serverUrl: string;
  }> {
    this.ensureInitialized();
    return await showProgress(
      "Generating authentication token",
      this.viewId,
      async () => {
        const response = await this.api!.credentials.generateToken(
          this.serverUrl,
        );
        return response.data;
      },
    );
  }

  private async openTokenClaimUrl(claimUrl: string): Promise<void> {
    await env.openExternal(Uri.parse(claimUrl));
  }

  private async pollForTokenClaim(
    token: string,
    privateKey: string,
    serverUrl: string,
  ): Promise<string> {
    this.ensureInitialized();
    return await showProgress(
      "Waiting for token to be claimed in browser...",
      this.viewId,
      async () => {
        let isClaimed = false;
        let attempt = 0;
        let userName = "";
        const maxAttempts = this.maxAttempts;

        while (!isClaimed && attempt < maxAttempts) {
          try {
            const response = await this.api!.credentials.verifyToken(
              serverUrl,
              token,
              privateKey,
            );

            // Check if we got a successful response with username data
            if (
              response.status === 200 &&
              response.data &&
              response.data.username
            ) {
              userName = response.data.username;
              isClaimed = true;
              logger.info(`Token claimed by user: ${userName}`);
            } else {
              logger.debug(
                `Token verification response without username: ${JSON.stringify(response.data)}`,
              );
              // Continue polling if username is missing - don't set isClaimed to true
            }
          } catch (e) {
            // Only log the error if it's not a 401 (which is expected when token isn't claimed yet)
            if (!this.isUnauthorizedError(e)) {
              logger.debug(
                `Error during token verification: ${getMessageFromError(e)}`,
              );
            }
            // Token not claimed yet, continue polling
          }

          if (!isClaimed) {
            await new Promise((resolve) => setTimeout(resolve, 500));
            attempt++;
          }
        }

        if (!isClaimed) {
          throw new Error("Token claim process timed out or was cancelled");
        }

        return userName;
      },
    );
  }

  private isUnauthorizedError(error: unknown): boolean {
    const err = error as {
      response?: { status?: number };
      status?: number;
      message?: string;
    };
    return (
      err?.response?.status === 401 ||
      err?.status === 401 ||
      err?.message?.includes("401") ||
      false
    );
  }

  private handleError(error: unknown): void {
    const message = `Failed to complete token authentication: ${getMessageFromError(error)}`;
    logger.error(message);
    window.showErrorMessage(message);
  }
}
