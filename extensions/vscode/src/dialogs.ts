import { MessageItem, l10n, window } from "vscode";

const okItem: MessageItem = {
  title: l10n.t("OK"),
};

const deleteItem: MessageItem = {
  title: l10n.t("Delete"),
};

const forgetItem: MessageItem = {
  title: l10n.t("Forget"),
};

async function confirm(message: string, yesItem: MessageItem): Promise<boolean> {
  const choice = await window.showInformationMessage(message, {
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
