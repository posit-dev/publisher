// Copyright (C) 2026 by Posit Software, PBC.

import { describe, expect, test } from "vitest";
import {
  isConnect,
  isConnectCloud,
  isSnowflake,
  isConnectProduct,
  isConnectCloudProduct,
  getProductType,
  getProductName,
  getServerType,
} from "./multiStepHelpers";
import {
  ServerType,
  ProductType,
  ProductName,
} from "../api/types/contentRecords";

describe("Server Type helpers", () => {
  describe("isConnect", () => {
    test("returns true for ServerType.CONNECT", () => {
      expect(isConnect(ServerType.CONNECT)).toBe(true);
    });

    test("returns false for ServerType.SNOWFLAKE", () => {
      expect(isConnect(ServerType.SNOWFLAKE)).toBe(false);
    });

    test("returns false for ServerType.CONNECT_CLOUD", () => {
      expect(isConnect(ServerType.CONNECT_CLOUD)).toBe(false);
    });
  });

  describe("isSnowflake", () => {
    test("returns true for ServerType.SNOWFLAKE", () => {
      expect(isSnowflake(ServerType.SNOWFLAKE)).toBe(true);
    });

    test("returns false for ServerType.CONNECT", () => {
      expect(isSnowflake(ServerType.CONNECT)).toBe(false);
    });

    test("returns false for ServerType.CONNECT_CLOUD", () => {
      expect(isSnowflake(ServerType.CONNECT_CLOUD)).toBe(false);
    });
  });

  describe("isConnectCloud", () => {
    test("returns true for ServerType.CONNECT_CLOUD", () => {
      expect(isConnectCloud(ServerType.CONNECT_CLOUD)).toBe(true);
    });

    test("returns false for ServerType.CONNECT", () => {
      expect(isConnectCloud(ServerType.CONNECT)).toBe(false);
    });

    test("returns false for ServerType.SNOWFLAKE", () => {
      expect(isConnectCloud(ServerType.SNOWFLAKE)).toBe(false);
    });
  });
});

describe("Product Type helpers", () => {
  describe("isConnectProduct", () => {
    test("returns true for ProductType.CONNECT", () => {
      expect(isConnectProduct(ProductType.CONNECT)).toBe(true);
    });

    test("returns false for ProductType.CONNECT_CLOUD", () => {
      expect(isConnectProduct(ProductType.CONNECT_CLOUD)).toBe(false);
    });
  });

  describe("isConnectCloudProduct", () => {
    test("returns true for ProductType.CONNECT_CLOUD", () => {
      expect(isConnectCloudProduct(ProductType.CONNECT_CLOUD)).toBe(true);
    });

    test("returns false for ProductType.CONNECT", () => {
      expect(isConnectCloudProduct(ProductType.CONNECT)).toBe(false);
    });
  });
});

describe("Type conversion helpers", () => {
  describe("getProductType", () => {
    test("returns ProductType.CONNECT for ServerType.CONNECT", () => {
      expect(getProductType(ServerType.CONNECT)).toBe(ProductType.CONNECT);
    });

    test("returns ProductType.CONNECT for ServerType.SNOWFLAKE", () => {
      // Snowflake is a Connect product (Connect running inside Snowflake)
      expect(getProductType(ServerType.SNOWFLAKE)).toBe(ProductType.CONNECT);
    });

    test("returns ProductType.CONNECT_CLOUD for ServerType.CONNECT_CLOUD", () => {
      expect(getProductType(ServerType.CONNECT_CLOUD)).toBe(
        ProductType.CONNECT_CLOUD,
      );
    });
  });

  describe("getProductName", () => {
    test("returns ProductName.CONNECT for ProductType.CONNECT", () => {
      expect(getProductName(ProductType.CONNECT)).toBe(ProductName.CONNECT);
    });

    test("returns ProductName.CONNECT_CLOUD for ProductType.CONNECT_CLOUD", () => {
      expect(getProductName(ProductType.CONNECT_CLOUD)).toBe(
        ProductName.CONNECT_CLOUD,
      );
    });
  });

  describe("getServerType", () => {
    test("returns ServerType.CONNECT for ProductName.CONNECT", () => {
      expect(getServerType(ProductName.CONNECT)).toBe(ServerType.CONNECT);
    });

    test("returns ServerType.CONNECT_CLOUD for ProductName.CONNECT_CLOUD", () => {
      expect(getServerType(ProductName.CONNECT_CLOUD)).toBe(
        ServerType.CONNECT_CLOUD,
      );
    });
  });
});
