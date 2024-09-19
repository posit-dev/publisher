// Copyright (C) 2024 by Posit Software, PBC.

import { InputBoxValidationSeverity, window } from "vscode";
import { extractGUID } from "src/utils/guid";
import { PublisherState } from "src/state";
import { showProgress } from "src/utils/progress";
import { Views } from "src/constants";
import { useApi } from "src/api";

export async function showAssociateGUID(state: PublisherState) {
  let urlOrGuid = "";
  const result = await window.showInputBox({
    title: "Enter the URL of the Existing Content Item on the Server",
    prompt: "Please provide the content's URL from Connect",
    value: urlOrGuid,
    placeHolder:
      "https://connect.company.co/connect/#/apps/adffa505-08c7-450f-88d0-f42957f56eff",
    validateInput: (text) => {
      const guid = extractGUID(text);
      if (guid === null) {
        return Promise.resolve({
          message: `Unexpected format for a Posit Connect Content URL. Confirm the URL loads content from the server and contains a content GUID.`,
          severity: InputBoxValidationSeverity.Error,
        });
      }
      return null;
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
  const targetContentRecord = await state.getSelectedContentRecord();
  if (targetContentRecord === undefined) {
    console.error("homeView::showAssociateGUID: No target deployment.");
    return undefined;
  }
  await showProgress("Updating Content Record", Views.HomeView, async () => {
    const api = await useApi();
    await api.contentRecords.patch(
      targetContentRecord.deploymentName,
      targetContentRecord.projectDir,
      {
        guid,
      },
    );
  });
}
