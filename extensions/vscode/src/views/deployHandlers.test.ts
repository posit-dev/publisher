// Copyright (C) 2025 by Posit Software, PBC.

import { beforeEach, describe, expect, test, vi } from "vitest";
import { EventStreamMessage } from "src/api";
import {
  EventStreamMessageErrorCoded,
  RenvAction,
  renvSetupEvtErr,
} from "src/eventErrors";
import { DeploymentFailureRenvHandler } from "./deployHandlers";

const windowMethodsMocks = {
  showErrorMessageWithTroubleshoot: vi.fn(),
  showInformationMsg: vi.fn(),
  runTerminalCommand: vi.fn(),
  openTerminalCommand: vi.fn(),
  taskWithProgressMsg: vi.fn((_: string, cb: () => void) => cb()),
};

vi.mock("src/utils/window", () => {
  return {
    runTerminalCommand: (c: string) => windowMethodsMocks.runTerminalCommand(c),
    openTerminalCommand: (c: string) =>
      windowMethodsMocks.openTerminalCommand(c),
    showInformationMsg: (m: string) => windowMethodsMocks.showInformationMsg(m),
    taskWithProgressMsg: (m: string, cb: () => void) =>
      windowMethodsMocks.taskWithProgressMsg(m, cb),
    showErrorMessageWithTroubleshoot: (m: string, l: string) =>
      windowMethodsMocks.showErrorMessageWithTroubleshoot(m, l),
  };
});

describe("Deploy Handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("DeploymentFailureRenvHandler", () => {
    describe("shouldHandleEventMsg", () => {
      test("not an renv setup error event", () => {
        const handler = new DeploymentFailureRenvHandler();
        const shouldHandle = handler.shouldHandleEventMsg({
          type: "publish/failure",
          time: new Date().toISOString(),
          data: {},
          errCode: "unknown",
        });
        expect(shouldHandle).toBe(false);
      });

      test("a true renv setup error event", () => {
        const errPayload: EventStreamMessage = {
          type: "publish/failure",
          time: new Date().toISOString(),
          data: {
            message: "Renv is not setup, click the button and smile",
            command: "renv::init()",
            action: "renvsetup",
            actionLabel: "Set it up",
          },
          errCode: "renvPackageNotInstalledError",
        };

        const handler = new DeploymentFailureRenvHandler();
        let shouldHandle = handler.shouldHandleEventMsg(errPayload);
        expect(shouldHandle).toBe(true);

        errPayload.errCode = "renvActionRequiredError";
        shouldHandle = handler.shouldHandleEventMsg(errPayload);
        expect(shouldHandle).toBe(true);
      });
    });

    describe("handle", () => {
      test("when suggested action is renv::status, we call to open the terminal without progress indicators", async () => {
        const errData: renvSetupEvtErr = {
          message: "Renv is not setup, click the button and smile",
          command: "/user/lib/R renv::status()",
          action: "renvstatus",
          actionLabel: "Set it up",
          dashboardUrl: "",
          localId: "",
          error: "",
        };
        const errPayload: EventStreamMessageErrorCoded<renvSetupEvtErr> = {
          type: "publish/failure",
          time: new Date().toISOString(),
          data: errData,
          errCode: "renvActionRequiredError",
        };

        // Fake user picks option to run setup command
        windowMethodsMocks.showErrorMessageWithTroubleshoot.mockResolvedValue(
          errData.actionLabel,
        );

        const handler = new DeploymentFailureRenvHandler();
        await handler.handle(errPayload);
        expect(
          windowMethodsMocks.showErrorMessageWithTroubleshoot,
        ).toHaveBeenCalledWith(errData.message, errData.actionLabel);
        expect(windowMethodsMocks.openTerminalCommand).toHaveBeenCalledWith(
          "/user/lib/R renv::status()",
        );

        // No progrss indicator is shown when we open the terminal
        expect(windowMethodsMocks.taskWithProgressMsg).not.toHaveBeenCalled();
      });

      test.each([
        ["renvsetup", `/user/lib/R install.packages("renv"); renv::init();`],
        ["renvinit", "/user/lib/R renv::init()"],
        ["renvsnapshot", "/user/lib/R renv::snapshot()"],
      ])(
        "for action %s, the provided command runs and notifies success",
        async (action: string, command: string) => {
          const errData: renvSetupEvtErr = {
            message: "Renv is not setup, click the button and smile",
            command,
            action: action as RenvAction,
            actionLabel: "Set it up",
            dashboardUrl: "",
            localId: "",
            error: "",
          };
          const errPayload: EventStreamMessageErrorCoded<renvSetupEvtErr> = {
            type: "publish/failure",
            time: new Date().toISOString(),
            data: errData,
            errCode: "renvActionRequiredError",
          };

          // Fake user picks option to run setup command
          windowMethodsMocks.showErrorMessageWithTroubleshoot.mockResolvedValueOnce(
            errData.actionLabel,
          );

          const handler = new DeploymentFailureRenvHandler();
          await handler.handle(errPayload);
          expect(
            windowMethodsMocks.showErrorMessageWithTroubleshoot,
          ).toHaveBeenCalledWith(errData.message, errData.actionLabel);
          expect(windowMethodsMocks.taskWithProgressMsg).toHaveBeenCalledWith(
            "Setting up renv for this project...",
            expect.any(Function),
          );
          // Terminal command executed
          expect(windowMethodsMocks.runTerminalCommand).toHaveBeenCalledWith(
            command,
          );
          expect(windowMethodsMocks.showInformationMsg).toHaveBeenCalledWith(
            "Finished setting up renv.",
          );
        },
      );

      test.each([
        ["renvsetup", `/user/lib/R install.packages("renv"); renv::init();`],
        ["renvinit", "/user/lib/R renv::init()"],
        ["renvsnapshot", "/user/lib/R renv::snapshot()"],
      ])(
        "terminal run failure for action %s, notifies of error",
        async (action: string, command: string) => {
          const errData: renvSetupEvtErr = {
            message: "Renv is not setup, click the button and smile",
            command,
            action: action as RenvAction,
            actionLabel: "Set it up",
            dashboardUrl: "",
            localId: "",
            error: "",
          };
          const errPayload: EventStreamMessageErrorCoded<renvSetupEvtErr> = {
            type: "publish/failure",
            time: new Date().toISOString(),
            data: errData,
            errCode: "renvActionRequiredError",
          };

          // Fake user picks option to run setup command
          windowMethodsMocks.showErrorMessageWithTroubleshoot.mockResolvedValueOnce(
            errData.actionLabel,
          );

          // Mock a rejection from terminal run
          windowMethodsMocks.taskWithProgressMsg.mockRejectedValueOnce(
            new Error("oh no"),
          );

          const handler = new DeploymentFailureRenvHandler();
          await handler.handle(errPayload);
          expect(
            windowMethodsMocks.showErrorMessageWithTroubleshoot,
          ).toHaveBeenCalledWith(errData.message, errData.actionLabel);
          expect(windowMethodsMocks.taskWithProgressMsg).toHaveBeenCalled();

          // The message shown is a troubleshoot error one
          expect(windowMethodsMocks.showInformationMsg).not.toHaveBeenCalled();
          expect(
            windowMethodsMocks.showErrorMessageWithTroubleshoot,
          ).toHaveBeenCalledWith(
            `Something went wrong while running renv command. Command used ${command}`,
            undefined,
          );
        },
      );
    });
  });
});
