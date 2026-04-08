// Copyright (C) 2025 by Posit Software, PBC.

import { window, Uri, env } from "vscode";
import { ConnectAPI, ConnectAPIError } from "@posit-dev/connect-api";
import { generateToken } from "./generateToken";
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
  private readonly insecure?: boolean;

  constructor(
    serverUrl: string,
    viewId: string,
    maxAttempts: number = 60,
    insecure?: boolean,
  ) {
    this.serverUrl = serverUrl;
    this.viewId = viewId;
    // default: 60 = 30 seconds with 500ms between attempts
    this.maxAttempts = maxAttempts;
    this.insecure = insecure;
  }

  async activateToken(): Promise<TokenAuthResult> {
    try {
      // Step 1: Generate token
      const { token, claimUrl, privateKey, serverUrl } =
        await this.requestToken();

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

  private async requestToken(): Promise<{
    token: string;
    claimUrl: string;
    privateKey: string;
    serverUrl: string;
  }> {
    return await showProgress(
      "Generating authentication token",
      this.viewId,
      async () => {
        return await generateToken(this.serverUrl, this.insecure);
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
    return await showProgress(
      "Waiting for token to be claimed in browser...",
      this.viewId,
      async () => {
        let isClaimed = false;
        let attempt = 0;
        let userName = "";
        const maxAttempts = this.maxAttempts;

        const client = new ConnectAPI({
          url: serverUrl,
          token,
          privateKey,
          rejectUnauthorized: this.insecure ? false : undefined,
        });

        while (!isClaimed && attempt < maxAttempts) {
          try {
            const { user } = await client.testAuthentication();
            userName = user.username;
            isClaimed = true;
            logger.info(`Token claimed by user: ${userName}`);
          } catch (e) {
            if (!(e instanceof ConnectAPIError && e.httpStatus === 401)) {
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

  private handleError(error: unknown): void {
    const message = `Failed to complete token authentication: ${getMessageFromError(error)}`;
    logger.error(message);
    window.showErrorMessage(message);
  }
}
