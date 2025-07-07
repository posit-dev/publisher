// Copyright (C) 2025 by Posit Software, PBC.

export type ConnectCloudConfig = {
  vanityName?: string;
  accessControl?: ConnectCloudAccessControl;
};

export type ConnectCloudAccessControl = {
  publicAccess?: boolean;
  organization_access?: "disabled" | "viewer" | "editor";
};
