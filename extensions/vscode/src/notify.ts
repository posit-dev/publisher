import { window } from 'vscode';
import { statusBarItem } from './extension';

const notifyVisibilityMS = 2000;

let notifyTimerId: NodeJS.Timeout | undefined;
let longRunningNotifyActive = false;

function cancelNotify() {
  if (notifyTimerId !== undefined) {
    // cancel the old one.
    clearTimeout(notifyTimerId);
  }
  statusBarItem.hide();
  statusBarItem.text = '';
  notifyTimerId = undefined;
}

function showNotifyMessageWithSpinner(message: string) {
  statusBarItem.text = `$(loading~spin) ${message}`;
  statusBarItem.show();
}

export function notify(message: string) {
  // if we have a long-running notify running, igore this request
  if (longRunningNotifyActive) {
    return;
  }
  longRunningNotifyActive = true;

  // if we're already showing one, cancel timer
  cancelNotify();

  // string format here passes on check icon to vscode api...
  showNotifyMessageWithSpinner(message);
  notifyTimerId = setTimeout(() => {
    cancelNotify();
  }, notifyVisibilityMS);
}

export async function alert(message: string): Promise<void> {
  await window.showInformationMessage(message, {
    modal: true,
  });
}

export function showLongRunningNotify(message: string) {
  // this overrides any existing notify
  cancelNotify();
  showNotifyMessageWithSpinner(message);
}

export function hideLongRunningNotify() {
  cancelNotify();
  longRunningNotifyActive = false;
}