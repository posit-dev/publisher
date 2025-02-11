// Copyright (C) 2025 by Posit Software, PBC.

import { EventStreamMessage } from "src/api";
import {
  EventStreamMessageErrorCoded,
  isEvtErrRenvEnvironmentSetup,
  isCodedEventErrorMessage,
  renvSetupEvtErr,
} from "src/eventErrors";
import {
  showErrorMessageWithTroubleshoot,
  showInformationMsg,
  runTerminalCommand,
  taskWithProgressMsg,
} from "src/utils/window";

export interface DeploymentFailureHandler {
  /**
   * Determine if the deployment failure handler should do something with an incoming event stream message.
   *
   * @param msg The EventStreamMessage to determine if the deployment failure handler should do something about it.
   */
  shouldHandleEventMsg(msg: EventStreamMessage): boolean;

  /**
   * Handle the incoming event stream message.
   *
   * @param msg The EventStreamMessage with the details for the given deployment failure handler to act upon it.
   */
  handle(msg: EventStreamMessage): Promise<void>;
}

export class DeploymentFailureRenvHandler implements DeploymentFailureHandler {
  shouldHandleEventMsg(
    msg: EventStreamMessage,
  ): msg is EventStreamMessageErrorCoded<renvSetupEvtErr> {
    return isCodedEventErrorMessage(msg) && isEvtErrRenvEnvironmentSetup(msg);
  }

  async handle(
    msg: EventStreamMessageErrorCoded<renvSetupEvtErr>,
  ): Promise<void> {
    const { message, command, action, actionLabel } = msg.data;
    const selection = await showErrorMessageWithTroubleshoot(
      message,
      actionLabel,
    );

    if (selection !== actionLabel) {
      return;
    }

    // If renv status is the action, then run the command and open the terminal
    if (action === "renvstatus") {
      return runTerminalCommand(`${command};`, true);
    }

    try {
      await taskWithProgressMsg("Setting up renv for this project...", () =>
        runTerminalCommand(`${command}; exit $?`),
      );
      showInformationMsg("Finished setting up renv.");
    } catch (_) {
      showErrorMessageWithTroubleshoot(
        `Something went wrong while running renv command. Command used ${command}`,
      );
    }
  }
}
