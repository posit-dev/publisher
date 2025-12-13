// Copyright (C) 2025 by Posit Software, PBC.

import { InputBoxValidationSeverity, window } from "vscode";
import { extractGUID } from "src/utils/guid";
import { PublisherState } from "src/state";
import { showProgress } from "src/utils/progress";
import { Views } from "src/constants";
import { ServerType, useApi, ProductType } from "src/api";
import { getSummaryStringFromError } from "src/utils/errors";
import {
  getProductName,
  getProductType,
  isConnectCloudProduct,
  isConnectProduct,
} from "src/utils/multiStepHelpers";
import {
  extractConnectCloudAccount,
  isConnectCloudContentURL,
} from "src/utils/url";
import config from "src/config";

/**
 * Validates a GUID or URL input for associating with existing content.
 * Exported for testing purposes.
 *
 * @param text - The input text (URL or GUID)
 * @param productType - The product type (Connect or Connect Cloud)
 * @param productName - The product name for error messages
 * @param accountName - The Connect Cloud account name (optional, only for Connect Cloud)
 * @returns null if valid, or a validation message object if invalid
 */
export function validateGuidInput(
  text: string,
  productType: ProductType,
  productName: string,
  accountName?: string,
): { message: string; severity: InputBoxValidationSeverity } | null {
  const guid = extractGUID(text);
  if (guid === null) {
    return {
      message: `Unexpected format for a ${productName} Content URL. Confirm the URL loads content from the server and contains a content GUID.`,
      severity: InputBoxValidationSeverity.Error,
    };
  }

  // For Connect Cloud, check the account matches if a URL was provided (not just a plain GUID)
  if (isConnectCloudProduct(productType) && isConnectCloudContentURL(text)) {
    const extractedAccount = extractConnectCloudAccount(text);
    if (extractedAccount !== accountName) {
      return {
        message: `Account mismatch for ${productName} Content URL. Please try again with published content for account: ${accountName}.`,
        severity: InputBoxValidationSeverity.Error,
      };
    }
  }

  // If we successfully extracted a GUID, accept the input
  // This allows: in-app URLs, standalone URLs, and plain GUIDs
  return null;
}

export async function showAssociateGUID(state: PublisherState) {
  const targetContentRecord = await state.getSelectedContentRecord();
  const serverType = targetContentRecord?.serverType || ServerType.CONNECT;
  const accountName = targetContentRecord?.connectCloud?.accountName;
  const productType = getProductType(serverType);
  const productName = getProductName(productType);
  const placeHolder = isConnectProduct(productType)
    ? "https://connect.company.co/connect/#/apps/adffa505-08c7-450f-88d0-f42957f56eff"
    : `${config.connectCloudURL}/my-account/content/adffa505-08c7-450f-88d0-f42957f56eff`;
  const urlOrGuid = "";
  const result = await window.showInputBox({
    title: "Enter the URL of the Existing Content Item on the Server",
    prompt: `Please provide the content's URL from ${productName}`,
    value: urlOrGuid,
    placeHolder,
    validateInput: (text) => {
      const validation = validateGuidInput(
        text,
        productType,
        productName,
        accountName,
      );
      return validation ? Promise.resolve(validation) : null;
    },
    ignoreFocusOut: true,
  });
  if (result === undefined) {
    return;
  }
  const guidArray = extractGUID(result);
  if (guidArray === null) {
    return;
  }
  const guid = guidArray[0];

  // patch the current deployment with the guid
  if (targetContentRecord === undefined) {
    console.error("homeView::showAssociateGUID: No target deployment.");
    return undefined;
  }
  await showProgress("Updating Content Record", Views.HomeView, async () => {
    try {
      const api = await useApi();
      await api.contentRecords.patch(
        targetContentRecord.deploymentName,
        targetContentRecord.projectDir,
        {
          guid,
        },
      );
      window.showInformationMessage(
        `Your deployment is now locally associated with Content GUID ${guid} as requested.`,
      );
    } catch (error: unknown) {
      const summary = getSummaryStringFromError(
        "showAssociateGUID, contentRecords.patch",
        error,
      );
      window.showErrorMessage(
        `Unable to associate deployment with Content GUID ${guid}. ${summary}`,
      );
    }
  });
}
