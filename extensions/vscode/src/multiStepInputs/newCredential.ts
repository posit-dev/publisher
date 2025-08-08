// Copyright (C) 2025 by Posit Software, PBC.

import {
  AbortError,
  InputStep,
  MultiStepInput,
  MultiStepState,
} from "./multiStepHelper";
import { Credential, ServerType, ProductName } from "src/api";
import { extensionSettings } from "src/extension";
import { isConnectCloud, platformList } from "src/multiStepInputs/common";
import { newConnectCredential } from "./newConnectCredential";
import { newConnectCloudCredential } from "./newConnectCloudCredential";
import { getEnumKeyByEnumValue } from "src/utils/enums";

export async function newCredential(
  viewId: string,
  viewTitle: string,
  startingServerUrl?: string,
  previousSteps?: InputStep[],
): Promise<Credential | undefined> {
  // the serverType will be overwritten in the very first step
  // when the platform is selected
  let serverType: ServerType = ServerType.CONNECT;
  let credential: Credential | undefined = undefined;

  // local step history that gets passed down to any sub-flows
  const stepHistory: InputStep[] = [];

  enum step {
    INPUT_PLATFORM = "inputPlatform",
  }

  const steps: Record<
    step,
    (input: MultiStepInput, state: MultiStepState) => Promise<void | InputStep>
  > = {
    [step.INPUT_PLATFORM]: inputPlatform,
  };

  const stepHistoryFlush = (name: string) => {
    if (!stepHistory.length) {
      // nothing to flush, bail!
      return;
    }
    // flush the step history after the step passed in if this is not the last step
    // added to the history so we don't double count the upcoming steps
    // this would mean the user landed back at this step from the backward flow
    if (stepHistory.at(-1)?.name !== name) {
      const index = stepHistory.findIndex((s) => s.name === name);
      if (index > -1) {
        stepHistory.splice(index + 1);
      }
    }
  };

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
      const currentStep = {
        name: step.INPUT_PLATFORM,
        step: (input: MultiStepInput) =>
          steps[step.INPUT_PLATFORM](input, state),
      };
      stepHistory.push(currentStep);
      await MultiStepInput.run(currentStep, previousSteps);
    } else {
      try {
        credential = await newConnectCredential(
          viewId,
          state.title,
          startingServerUrl,
          previousSteps,
        );
      } catch {
        /* the user dismissed this flow, do nothing more */
      }
    }
    return state;
  }

  // ***************************************************************
  // Step: Select the platform for the credential (used for all platforms)
  // ***************************************************************
  async function inputPlatform(input: MultiStepInput, state: MultiStepState) {
    stepHistoryFlush(step.INPUT_PLATFORM);

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

    const prevSteps = [...(previousSteps || []), ...stepHistory];
    if (isConnectCloud(serverType)) {
      try {
        credential = await newConnectCloudCredential(
          viewId,
          state.title,
          prevSteps,
        );
      } catch {
        /* the user dismissed this flow, do nothing more */
      }
      return;
    }

    // CONNECT was selected
    try {
      credential = await newConnectCredential(
        viewId,
        state.title,
        startingServerUrl,
        prevSteps,
      );
    } catch {
      /* the user dismissed this flow, do nothing more */
    }
    return;
  }

  // ***************************************************************
  // Kick off the input collection and await until it completes.
  // ***************************************************************
  await collectInputs();

  // make sure user has not hit escape or moved away from the window
  // before completing the steps. This also serves as a type guard on
  // our state data vars down to the actual type desired
  if (!credential) {
    console.log("User has dismissed the New Credential flow. Exiting.");
    throw new AbortError();
  }

  return credential;
}
