// Copyright (C) 2025 by Posit Software, PBC.

import {
  MultiStepInput,
  MultiStepState,
  isQuickPickItem,
} from "./multiStepHelper";

import { ServerType, ProductName } from "src/api";
import { extensionSettings } from "src/extension";
import { isConnectCloud, platformList } from "src/multiStepInputs/common";
import { newConnectCredential } from "./newConnectCredential";
import { newConnectCloudCredential } from "./newConnectCloudCredential";
import { getEnumKeyByEnumValue } from "src/utils/enums";

const viewTitle = "Create a New Credential";

export async function newCredential(
  viewId: string,
  startingServerUrl?: string,
): Promise<string | undefined> {
  // the serverType will be overwritten in the very first step
  // when the platform is selected
  let serverType: ServerType = ServerType.CONNECT;

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
      data: {
        // each attribute is initialized to undefined
        // to be returned when it has not been canceled
        name: <string | undefined>undefined, // eventual type is string
      },
      promptStepNumbers: {},
    };

    if (extensionSettings.enableConnectCloud()) {
      // select the platform only when the enableConnectCloud config has been turned on
      await MultiStepInput.run({
        step: (input) => inputPlatform(input, state),
      });
    } else {
      state.data.name = await newConnectCredential(
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
      state.data.name = await newConnectCloudCredential(viewId, viewTitle);
      return;
    }

    // CONNECT was selected
    state.data.name = await newConnectCredential(
      viewId,
      viewTitle,
      startingServerUrl,
    );
  }

  // ***************************************************************
  // Kick off the input collection
  // ***************************************************************
  const state = await collectInputs();

  // make sure user has not hit escape or moved away from the window
  // before completing the steps. This also serves as a type guard on
  // our state data vars down to the actual type desired
  if (
    // have to add type guards here to eliminate the variability
    state.data.name === undefined ||
    isQuickPickItem(state.data.name)
  ) {
    return;
  }

  return state.data.name;
}
