// Copyright (C) 2024 by Posit Software, PBC.

export enum SecretAction {
  ADD = "add",
  REMOVE = "remove",
}

export type PostSecretBody = {
  action: SecretAction;
  secret: string;
};
