// Copyright (C) 2025 by Posit Software, PBC.

import { MultiStepInput, MultiStepState } from "./multiStepHelper";
import { Credential, ServerType, ProductName } from "src/api";
import { extensionSettings } from "src/extension";
import { isConnectCloud, platformList } from "src/multiStepInputs/common";
import { newConnectCredential } from "./newConnectCredential";
import { newConnectCloudCredential } from "./newConnectCloudCredential";
import { getEnumKeyByEnumValue } from "src/utils/enums";

const viewTitle = "Create a New Credential";

export async function newCredential(
  viewId: string,
  startingServerUrl?: string,
): Promise<Credential | undefined> {
  // the serverType will be overwritten in the very first step
  // when the platform is selected
  let serverType: ServerType = ServerType.CONNECT;
  let newCredential: Credential | undefined = undefined;

  // ***************************************************************
  // Order of all steps for creating a new credential
  // ***************************************************************

  // Select the platform
  // Create a new Connect or Connect Cloud credential

  // ***************************************************************
  // Method which kicks off the multi-step.
  // Initialize the state data
  // Display the first input panel
  // ***************************************************************
  async function collectInputs() {
    const state: MultiStepState = {
      title: viewTitle,
      // We're going to disable displaying the steps due to the complex
      // nature of calculation with multiple paths through this flow.
      step: 0,
      lastStep: 0,
      totalSteps: 0,
      data: {},
      promptStepNumbers: {},
    };

    if (extensionSettings.enableConnectCloud()) {
      // select the platform only when the enableConnectCloud config has been turned on
      await MultiStepInput.run({
        step: (input) => inputPlatform(input, state),
      });
    } else {
      newCredential = await newConnectCredential(
        viewId,
        viewTitle,
        startingServerUrl,
      );
    }
    return state;
  }

  // ***************************************************************
  // Step: Select the platform for the credential (used for all platforms)
  // ***************************************************************
  async function inputPlatform(input: MultiStepInput, state: MultiStepState) {
    const pick = await input.showQuickPick({
      title: state.title,
      step: 0,
      totalSteps: 0,
      placeholder: "Please select the platform for the new credential.",
      items: platformList,
      buttons: [],
      shouldResume: () => Promise.resolve(false),
      ignoreFocusOut: true,
    });

    const enumKey = getEnumKeyByEnumValue(ProductName, pick.label);
    // fallback to the default if there is ever a case when the enumKey is not found
    serverType = enumKey ? ServerType[enumKey] : serverType;

    if (isConnectCloud(serverType)) {
      newCredential = await newConnectCloudCredential(viewId, viewTitle);
      return;
    }

    // CONNECT was selected
    newCredential = await newConnectCredential(
      viewId,
      viewTitle,
      startingServerUrl,
    );
  }

  // ***************************************************************
  // Kick off the input collection and await until it completes.
  // ***************************************************************
  await collectInputs();

  // make sure user has not hit escape or moved away from the window
  // before completing the steps. This also serves as a type guard on
  // our state data vars down to the actual type desired
  if (!newCredential) {
    console.log("User has dismissed the New Credential flow. Exiting.");
    return;
  }

  return newCredential;
}
