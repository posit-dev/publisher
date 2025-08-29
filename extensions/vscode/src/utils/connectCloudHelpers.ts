// Copyright (C) 2025 by Posit Software, PBC.

import {
  AllContentRecordTypes,
  isContentRecordError,
  isContentRecord,
  EventStreamMessage,
  ProductType,
} from "src/api";
import { getProductType, isConnectCloudProduct } from "./multiStepHelpers";

// traffic params are used in Connect Cloud to gather data about
// the traffic coming from Publisher usage to Connect Cloud
export const getConnectCloudTrafficParams = (ideName: string) => {
  return `?utm_source=publisher-${ideName.trim().toLowerCase().replaceAll(" ", "-")}`;
};

// given a valid content record add the Connect Cloud traffict params
// to the `dashboardUrl` and `logsUrl` if available
export const recordAddConnectCloudUrlParams = (
  record: AllContentRecordTypes,
  ideName: string,
) => {
  if (!isContentRecordError(record)) {
    const productType = getProductType(record.serverType);
    if (isConnectCloudProduct(productType)) {
      const params = getConnectCloudTrafficParams(ideName);
      if (record.dashboardUrl && !record.dashboardUrl.includes(params)) {
        record.dashboardUrl += `${params}`;
      }
      if (
        isContentRecord(record) &&
        record.logsUrl &&
        !record.logsUrl.includes(params)
      ) {
        record.logsUrl += `${params}`;
      }
    }
  }
  return record;
};

// given an EventStreamMessage add the Connect Cloud traffict params
// to the `dashboardUrl` and `logsUrl` if available
export const msgAddConnectCloudUrlParams = (
  msg: EventStreamMessage,
  ideName: string,
) => {
  if (isConnectCloudProduct(msg.data.productType as ProductType)) {
    const params = getConnectCloudTrafficParams(ideName);
    if (msg.data?.dashboardUrl && !msg.data.dashboardUrl.includes(params)) {
      msg.data.dashboardUrl += `${params}`;
    }
    if (msg.data?.logsUrl && !msg.data.logsUrl.includes(params)) {
      msg.data.logsUrl += `${params}`;
    }
  }
  return msg;
};
