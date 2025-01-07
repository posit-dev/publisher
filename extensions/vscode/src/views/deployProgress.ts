// Copyright (C) 2024 by Posit Software, PBC.

import { ProgressLocation, Uri, env, window } from "vscode";
import { EventStreamMessage, eventMsgToString } from "src/api";
import { EventStream, UnregisterCallback } from "src/events";

export function deployProject(streamID: string, stream: EventStream) {
  window.withProgress(
    {
      location: ProgressLocation.Notification,
      title: `Deploying your project`,
      cancellable: false,
    },
    (progress) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let resolveCB: (reason?: any) => void;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let rejectCB: (reason?: any) => void;
      const registrations: UnregisterCallback[] = [];

      const unregisterAll = () => {
        registrations.forEach((cb) => cb.unregister());
      };

      const promise = new Promise<void>((resolve, reject) => {
        resolveCB = resolve;
        rejectCB = reject;
      });

      registrations.push(
        stream.register("publish/start", (msg: EventStreamMessage) => {
          if (streamID === msg.data.localId) {
            progress.report({ message: "Starting to Deploy..." });
          }
        }),
      );

      const handleProgressMessages = (msg: EventStreamMessage) => {
        if (streamID === msg.data.localId) {
          const progressStr = eventMsgToString(msg);
          progress.report({
            message: progressStr,
          });
        }
      };

      registrations.push(
        stream.register(
          "publish/checkCapabilities/start",
          (msg: EventStreamMessage) => {
            handleProgressMessages(msg);
          },
        ),
      );
      registrations.push(
        stream.register(
          "publish/checkCapabilities/log",
          (msg: EventStreamMessage) => {
            handleProgressMessages(msg);
          },
        ),
      );
      registrations.push(
        stream.register(
          "publish/checkCapabilities/success",
          (msg: EventStreamMessage) => {
            handleProgressMessages(msg);
          },
        ),
      );
      registrations.push(
        stream.register(
          "publish/checkCapabilities/failure",
          (msg: EventStreamMessage) => {
            handleProgressMessages(msg);
          },
        ),
      );
      registrations.push(
        stream.register(
          "publish/createNewDeployment/start",
          (msg: EventStreamMessage) => {
            handleProgressMessages(msg);
          },
        ),
      );
      registrations.push(
        stream.register(
          "publish/createNewDeployment/success",
          (msg: EventStreamMessage) => {
            handleProgressMessages(msg);
          },
        ),
      );
      registrations.push(
        stream.register(
          "publish/createNewDeployment/failure",
          (msg: EventStreamMessage) => {
            handleProgressMessages(msg);
          },
        ),
      );
      registrations.push(
        stream.register(
          "publish/setEnvVars/start",
          (msg: EventStreamMessage) => {
            handleProgressMessages(msg);
          },
        ),
      );
      registrations.push(
        stream.register(
          "publish/setEnvVars/success",
          (msg: EventStreamMessage) => {
            handleProgressMessages(msg);
          },
        ),
      );
      registrations.push(
        stream.register(
          "publish/setEnvVars/failure",
          (msg: EventStreamMessage) => {
            handleProgressMessages(msg);
          },
        ),
      );
      registrations.push(
        stream.register(
          "publish/createBundle/start",
          (msg: EventStreamMessage) => {
            handleProgressMessages(msg);
          },
        ),
      );
      registrations.push(
        stream.register(
          "publish/createBundle/success",
          (msg: EventStreamMessage) => {
            handleProgressMessages(msg);
          },
        ),
      );
      registrations.push(
        stream.register(
          "publish/createBundle/failure",
          (msg: EventStreamMessage) => {
            handleProgressMessages(msg);
          },
        ),
      );
      registrations.push(
        stream.register(
          "publish/createBundle/failure",
          (msg: EventStreamMessage) => {
            handleProgressMessages(msg);
          },
        ),
      );
      registrations.push(
        stream.register(
          "publish/createDeployment/start",
          (msg: EventStreamMessage) => {
            handleProgressMessages(msg);
          },
        ),
      );
      registrations.push(
        stream.register(
          "publish/createDeployment/success",
          (msg: EventStreamMessage) => {
            handleProgressMessages(msg);
          },
        ),
      );
      registrations.push(
        stream.register(
          "publish/createDeployment/failure",
          (msg: EventStreamMessage) => {
            handleProgressMessages(msg);
          },
        ),
      );
      registrations.push(
        stream.register(
          "publish/createDeployment/log",
          (msg: EventStreamMessage) => {
            handleProgressMessages(msg);
          },
        ),
      );
      registrations.push(
        stream.register(
          "publish/uploadBundle/start",
          (msg: EventStreamMessage) => {
            handleProgressMessages(msg);
          },
        ),
      );
      registrations.push(
        stream.register(
          "publish/uploadBundle/success",
          (msg: EventStreamMessage) => {
            handleProgressMessages(msg);
          },
        ),
      );
      registrations.push(
        stream.register(
          "publish/uploadBundle/failure",
          (msg: EventStreamMessage) => {
            handleProgressMessages(msg);
          },
        ),
      );
      registrations.push(
        stream.register(
          "publish/uploadBundle/log",
          (msg: EventStreamMessage) => {
            handleProgressMessages(msg);
          },
        ),
      );
      registrations.push(
        stream.register(
          "publish/deployBundle/start",
          (msg: EventStreamMessage) => {
            handleProgressMessages(msg);
          },
        ),
      );
      registrations.push(
        stream.register(
          "publish/deployBundle/success",
          (msg: EventStreamMessage) => {
            handleProgressMessages(msg);
          },
        ),
      );
      registrations.push(
        stream.register(
          "publish/deployBundle/failure",
          (msg: EventStreamMessage) => {
            handleProgressMessages(msg);
          },
        ),
      );
      registrations.push(
        stream.register(
          "publish/deployBundle/log",
          (msg: EventStreamMessage) => {
            handleProgressMessages(msg);
          },
        ),
      );
      registrations.push(
        stream.register(
          "publish/restoreEnv/start",
          (msg: EventStreamMessage) => {
            handleProgressMessages(msg);
          },
        ),
      );
      registrations.push(
        stream.register(
          "publish/restoreEnv/success",
          (msg: EventStreamMessage) => {
            handleProgressMessages(msg);
          },
        ),
      );
      registrations.push(
        stream.register(
          "publish/restoreEnv/failure",
          (msg: EventStreamMessage) => {
            handleProgressMessages(msg);
          },
        ),
      );
      registrations.push(
        stream.register("publish/restoreEnv/log", (msg: EventStreamMessage) => {
          handleProgressMessages(msg);
        }),
      );
      registrations.push(
        stream.register(
          "publish/restoreEnv/progress",
          (msg: EventStreamMessage) => {
            handleProgressMessages(msg);
          },
        ),
      );
      registrations.push(
        stream.register(
          "publish/restoreEnv/status",
          (msg: EventStreamMessage) => {
            handleProgressMessages(msg);
          },
        ),
      );
      registrations.push(
        stream.register(
          "publish/runContent/start",
          (msg: EventStreamMessage) => {
            handleProgressMessages(msg);
          },
        ),
      );
      registrations.push(
        stream.register(
          "publish/runContent/success",
          (msg: EventStreamMessage) => {
            handleProgressMessages(msg);
          },
        ),
      );
      registrations.push(
        stream.register(
          "publish/runContent/failure",
          (msg: EventStreamMessage) => {
            handleProgressMessages(msg);
          },
        ),
      );
      registrations.push(
        stream.register("publish/runContent/log", (msg: EventStreamMessage) => {
          handleProgressMessages(msg);
        }),
      );
      registrations.push(
        stream.register(
          "publish/setVanityURL/start",
          (msg: EventStreamMessage) => {
            handleProgressMessages(msg);
          },
        ),
      );
      registrations.push(
        stream.register(
          "publish/setVanityURL/success",
          (msg: EventStreamMessage) => {
            handleProgressMessages(msg);
          },
        ),
      );
      registrations.push(
        stream.register(
          "publish/setVanityURL/failure",
          (msg: EventStreamMessage) => {
            handleProgressMessages(msg);
          },
        ),
      );
      registrations.push(
        stream.register(
          "publish/setVanityURL/log",
          (msg: EventStreamMessage) => {
            handleProgressMessages(msg);
          },
        ),
      );
      registrations.push(
        stream.register(
          "publish/validateDeployment/start",
          (msg: EventStreamMessage) => {
            handleProgressMessages(msg);
          },
        ),
      );
      registrations.push(
        stream.register(
          "publish/validateDeployment/success",
          (msg: EventStreamMessage) => {
            handleProgressMessages(msg);
          },
        ),
      );
      registrations.push(
        stream.register(
          "publish/validateDeployment/failure",
          (msg: EventStreamMessage) => {
            handleProgressMessages(msg);
          },
        ),
      );
      registrations.push(
        stream.register(
          "publish/validateDeployment/log",
          (msg: EventStreamMessage) => {
            handleProgressMessages(msg);
          },
        ),
      );

      registrations.push(
        stream.register("publish/success", async (msg: EventStreamMessage) => {
          if (streamID === msg.data.localId) {
            unregisterAll();
            progress.report({
              message: "Deployment was successful",
            });
            resolveCB("Success!");

            const visitOption = "View";
            const selection = await window.showInformationMessage(
              "Deployment was successful",
              visitOption,
            );
            if (selection === visitOption) {
              const uri = Uri.parse(msg.data.dashboardUrl, true);
              await env.openExternal(uri);
            }
          }
        }),
      );

      registrations.push(
        stream.register("publish/failure", (msg: EventStreamMessage) => {
          if (streamID === msg.data.localId) {
            unregisterAll();
            progress.report({
              message: "Deployment process encountered an error",
            });
            rejectCB("Error Encountered!");
          }
        }),
      );

      return promise;
    },
  );
}
