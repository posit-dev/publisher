// Copyright (C) 2025 by Posit Software, PBC.

import { ServerType, ProductType, ProductName } from "../api";
import { ConnectCloudAccount } from "../api/types/connectCloud";

export const createNewCredentialLabel = "Create a New Credential";

export const isConnect = (serverType: ServerType) => {
  return serverType === ServerType.CONNECT;
};

export const isConnectCloud = (serverType: ServerType) => {
  return serverType === ServerType.CONNECT_CLOUD;
};

export const isSnowflake = (serverType: ServerType) => {
  return serverType === ServerType.SNOWFLAKE;
};

export const isConnectProduct = (productType: ProductType) => {
  return productType === ProductType.CONNECT;
};

export const isConnectCloudProduct = (productType: ProductType) => {
  return productType === ProductType.CONNECT_CLOUD;
};

export const getProductType = (serverType: ServerType): ProductType => {
  switch (serverType) {
    case ServerType.CONNECT:
      return ProductType.CONNECT;
    case ServerType.SNOWFLAKE:
      return ProductType.CONNECT;
    case ServerType.CONNECT_CLOUD:
      return ProductType.CONNECT_CLOUD;
  }
};

export const getProductName = (productType: ProductType) => {
  switch (productType) {
    case ProductType.CONNECT:
      return ProductName.CONNECT;
    case ProductType.CONNECT_CLOUD:
      return ProductName.CONNECT_CLOUD;
  }
};

export const getServerType = (productName: ProductName) => {
  switch (productName) {
    case ProductName.CONNECT:
      return ServerType.CONNECT;
    case ProductName.CONNECT_CLOUD:
      return ServerType.CONNECT_CLOUD;
  }
};

export const getPublishableAccounts = (accounts: ConnectCloudAccount[]) => {
  return accounts.filter((a) => a.permissionToPublish);
};
