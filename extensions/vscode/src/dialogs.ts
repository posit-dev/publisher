// Copyright (C) 2024 by Posit Software, PBC.

import { MessageItem, l10n, window } from 'vscode';

const okItem: MessageItem = {
  title: l10n.t("OK"),
};

const deleteItem: MessageItem = {
  title: l10n.t("Delete"),
};

const forgetItem: MessageItem = {
  title: l10n.t("Forget"),
};

const updateItem: MessageItem = {
  title: l10n.t("Update"),
};

const replaceItem: MessageItem = {
  title: l10n.t("Replace"),
};

const yesItem: MessageItem = {
  title: l10n.t('Yes'),
};

async function confirm(message: string, affirmativeItem: MessageItem): Promise<boolean> {
  const choice = await window.showInformationMessage(message, {
    modal: true,
  }, affirmativeItem);
  return choice === affirmativeItem;
}

export async function confirmOK(message: string): Promise<boolean> {
  return confirm(message, okItem);
}

export async function confirmYes(message: string): Promise<boolean> {
  return confirm(message, yesItem);
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

export async function confirmUpdate(message: string): Promise<boolean> {
  return confirm(message, updateItem);
}

export async function alert(message: string): Promise<void> {
  await window.showInformationMessage(message, {
    modal: true,
  });
}
