// Copyright (C) 2024 by Posit Software, PBC.

import { ProgressLocation, Uri, env, window } from "vscode";
import {
  EventStreamMessage,
  eventMsgToString,
  useApi,
  ContentRecord,
  PreContentRecord,
  PreContentRecordWithConfig,
} from "src/api";
import { EventStream, UnregisterCallback } from "src/events";
import { getSummaryStringFromError } from "src/utils/errors";
import { getProductName } from "src/utils/multiStepHelpers";
import { HostToWebviewMessageType } from "src/types/messages/hostToWebviewMessages";
import { WebviewConduit } from "src/utils/webviewConduit";

type UpdateActiveContentRecordCB = (
  contentRecord: ContentRecord | PreContentRecord | PreContentRecordWithConfig,
) => void;

export function deployProject(
  deploymentName: string,
  dir: string,
  localID: string,
  stream: EventStream,
  updateActiveContentRecordCB: UpdateActiveContentRecordCB,
) {
  const webviewConduit = new WebviewConduit();

  window.withProgress(
    {
      location: ProgressLocation.Notification,
      title: `Deploying your project`,
      cancellable: true,
    },
    (progress, token) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let resolveCB: (reason?: any) => void;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let rejectCB: (reason?: any) => void;
      const registrations: UnregisterCallback[] = [];
      const promise = new Promise<void>((resolve, reject) => {
        resolveCB = resolve;
        rejectCB = reject;
      });
      let streamID = localID;

      const unregisterAll = () => {
        registrations.forEach((cb) => cb.unregister());
      };

      token.onCancellationRequested(async () => {
        const api = await useApi();
        streamID = "NEVER_A_VALID_STREAM";
        unregisterAll();
        try {
          const response = await api.contentRecords.cancelDeployment(
            deploymentName,
            dir,
            localID,
          );

          // update the UX locally
          updateActiveContentRecordCB(response.data);

          const productName = getProductName(
            response.data.configuration.productType,
          );

          // we must have been successful...
          // inject a psuedo end of publishing event
          stream.injectMessage({
            type: "publish/failure",
            time: Date.now().toString(),
            data: {
              dashboardUrl: "",
              url: "",
              // and other non-defined attributes
              localId: localID,
              canceled: "true",
              message: `Deployment has been dismissed, but may continue to be processed on the ${productName} Server.`,
            },
            error: "Deployment has been dismissed.",
          });
          stream.suppressMessages(localID);
        } catch (error: unknown) {
          const summary = getSummaryStringFromError(
            "deployProject, token.onCancellationRequested",
            error,
          );
          window.showErrorMessage(`Unable to dismiss deployment: ${summary}`);
        } finally {
          webviewConduit.sendMsg({
            kind: HostToWebviewMessageType.PUBLISH_CANCEL,
          });
        }
        resolveCB();
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
          "publish/deployContent/start",
          (msg: EventStreamMessage) => {
            handleProgressMessages(msg);
          },
        ),
      );
      registrations.push(
        stream.register(
          "publish/deployContent/success",
          (msg: EventStreamMessage) => {
            handleProgressMessages(msg);
          },
        ),
      );
      registrations.push(
        stream.register(
          "publish/deployContent/failure",
          (msg: EventStreamMessage) => {
            handleProgressMessages(msg);
          },
        ),
      );
      registrations.push(
        stream.register(
          "publish/deployContent/log",
          (msg: EventStreamMessage) => {
            handleProgressMessages(msg);
          },
        ),
      );
      registrations.push(
        stream.register(
          "publish/updateContent/start",
          (msg: EventStreamMessage) => {
            handleProgressMessages(msg);
          },
        ),
      );
      registrations.push(
        stream.register(
          "publish/updateContent/success",
          (msg: EventStreamMessage) => {
            handleProgressMessages(msg);
          },
        ),
      );
      registrations.push(
        stream.register(
          "publish/updateContent/failure",
          (msg: EventStreamMessage) => {
            handleProgressMessages(msg);
          },
        ),
      );
      registrations.push(
        stream.register(
          "publish/updateContent/log",
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
              const dashboardUrl = msg.data.dashboardUrl;
              if (dashboardUrl) {
                const uri = Uri.parse(dashboardUrl, true);
                await env.openExternal(uri);
              }
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
