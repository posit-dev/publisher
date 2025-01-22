import { window } from "vscode";

export function showErrorMessageWithTroubleshoot(
  message: string,
  ...items: string[]
) {
  const msg = `${message} See [Troubleshooting docs](https://github.com/posit-dev/publisher/blob/main/docs/troubleshooting.md) for help.`;
  return window.showErrorMessage(msg, ...items);
}
