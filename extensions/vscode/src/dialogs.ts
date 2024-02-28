import * as vscode from 'vscode';

const okItem: vscode.MessageItem = {
  title: vscode.l10n.t("OK"),
};

const deleteItem: vscode.MessageItem = {
  title: vscode.l10n.t("Delete"),
};

const forgetItem: vscode.MessageItem = {
  title: vscode.l10n.t("Forget"),
};

const replaceItem: vscode.MessageItem = {
  title: vscode.l10n.t("Replace"),
};

async function confirm(message: string, yesItem: vscode.MessageItem): Promise<boolean> {
  const choice = await vscode.window.showInformationMessage(message, {
    modal: true,
  }, yesItem);
  return choice === yesItem;
}

export async function confirmOK(message: string): Promise<boolean> {
  return confirm(message, okItem);
}

export async function confirmDelete(message: string): Promise<boolean> {
  return confirm(message, deleteItem);
}

export async function confirmForget(message: string): Promise<boolean> {
  return confirm(message, forgetItem);
}

export async function confirmReplace(message: string): Promise<boolean> {
  return confirm(message, replaceItem);
}

export async function alert(message: string): Promise<void> {
  await vscode.window.showInformationMessage(message, {
    modal: true,
  });
}
