import { window } from 'vscode';
import { statusBarItem } from './extension';

const notifyVisibilityMS = 2000;

let notifyTimerId: NodeJS.Timeout | undefined;

export function notify(message: string) {
  // if we're already showing one, cancel timer
  if (notifyTimerId) {
    // cancel the old one.
    clearTimeout(notifyTimerId);
    statusBarItem.hide();
  }
  // string format here passes on check icon to vscode api...
  statusBarItem.text = `$(loading~spin) ${message}`;
  statusBarItem.show();
  notifyTimerId = setTimeout(() => {
    statusBarItem.text = '';
    statusBarItem.hide();
    notifyTimerId = undefined;
  }, notifyVisibilityMS);
}

export async function alert(message: string): Promise<void> {
  await window.showInformationMessage(message, {
    modal: true,
  });
}