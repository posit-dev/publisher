// Copyright (C) 2026 by Posit Software, PBC.

import { describe, expect, it } from "vitest";
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import schema from "./schemas/posit-publishing-schema-v3.json";

const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
const validate = ajv.compile(schema);

// Helper: create a minimal valid config for a given product_type
function baseConfig(productType: string): Record<string, unknown> {
  return {
    $schema:
      "https://cdn.posit.co/publisher/schemas/posit-publishing-schema-v3.json",
    product_type: productType,
    type: "html",
    entrypoint: "index.html",
  };
}

// Helper: set a nested property on an object, creating intermediate objects as needed
function setNested(
  obj: Record<string, unknown>,
  path: string[],
  key: string,
  value: unknown,
): void {
  let target = obj;
  for (const segment of path) {
    if (target[segment] === undefined) {
      target[segment] = {};
    }
    target = target[segment] as Record<string, unknown>;
  }
  target[key] = value;
}

function expectValid(data: Record<string, unknown>): void {
  const valid = validate(data);
  expect(
    valid,
    `Expected valid but got errors: ${JSON.stringify(validate.errors)}`,
  ).toBe(true);
}

function expectInvalid(data: Record<string, unknown>): void {
  const valid = validate(data);
  expect(valid, "Expected validation to fail").toBe(false);
}

describe("schema validates valid configs", () => {
  it("connect config without product_type", () => {
    const data = baseConfig("connect");
    delete data.product_type;
    expectValid(data);
  });

  it("connect config with product_type", () => {
    expectValid(baseConfig("connect"));
  });

  it("connect cloud config with product_type", () => {
    const data = baseConfig("connect_cloud");
    data.python = { version: "3.11" };
    expectValid(data);
  });

  it("connect config with integration_requests", () => {
    const data = baseConfig("connect");
    data.integration_requests = [
      { guid: "12345678-1234-1234-1234-1234567890ab" },
    ];
    expectValid(data);
  });
});

describe("schema rejects unknown property at root", () => {
  it("rejects unknown root property", () => {
    const data = baseConfig("connect");
    data.garbage = "value";
    expectInvalid(data);
  });
});

describe("schema rejects invalid integration_requests", () => {
  it("rejects integration_requests as string instead of array", () => {
    const data = baseConfig("connect");
    data.integration_requests = "string-instead-of-array";
    expectInvalid(data);
  });

  it("rejects integration_requests with string instead of object", () => {
    const data = baseConfig("connect");
    data.integration_requests = ["string-instead-of-object"];
    expectInvalid(data);
  });
});

describe("schema rejects disallowed properties for Connect", () => {
  it("rejects python.garbage", () => {
    const data = baseConfig("connect");
    setNested(data, ["python"], "garbage", "value");
    expectInvalid(data);
  });

  it("rejects r.garbage", () => {
    const data = baseConfig("connect");
    setNested(data, ["r"], "garbage", "value");
    expectInvalid(data);
  });

  it("rejects jupyter.garbage", () => {
    const data = baseConfig("connect");
    setNested(data, ["jupyter"], "garbage", "value");
    expectInvalid(data);
  });

  it("rejects quarto.garbage", () => {
    const data = baseConfig("connect");
    setNested(data, ["quarto"], "garbage", "value");
    expectInvalid(data);
  });

  it("rejects connect.garbage", () => {
    const data = baseConfig("connect");
    setNested(data, ["connect"], "garbage", "value");
    expectInvalid(data);
  });

  it("rejects connect.runtime.garbage", () => {
    const data = baseConfig("connect");
    setNested(data, ["connect", "runtime"], "garbage", "value");
    expectInvalid(data);
  });

  it("rejects connect.kubernetes.garbage", () => {
    const data = baseConfig("connect");
    setNested(data, ["connect", "kubernetes"], "garbage", "value");
    expectInvalid(data);
  });

  it("rejects connect.access.garbage", () => {
    const data = baseConfig("connect");
    setNested(data, ["connect", "access"], "garbage", "value");
    expectInvalid(data);
  });

  it("rejects connect_cloud section with connect product_type", () => {
    const data = baseConfig("connect");
    data.connect_cloud = {};
    expectInvalid(data);
  });
});

describe("schema rejects disallowed properties for Connect Cloud", () => {
  it("rejects python.garbage", () => {
    const data = baseConfig("connect_cloud");
    setNested(data, ["python"], "garbage", "value");
    expectInvalid(data);
  });

  it("rejects python.requires_python", () => {
    const data = baseConfig("connect_cloud");
    setNested(data, ["python"], "requires_python", ">=3.8");
    expectInvalid(data);
  });

  it("rejects python.package_file", () => {
    const data = baseConfig("connect_cloud");
    setNested(data, ["python"], "package_file", "requirements.txt");
    expectInvalid(data);
  });

  it("rejects python.package_manager", () => {
    const data = baseConfig("connect_cloud");
    setNested(data, ["python"], "package_manager", "pip");
    expectInvalid(data);
  });

  it("rejects r.garbage", () => {
    const data = baseConfig("connect_cloud");
    setNested(data, ["r"], "garbage", "value");
    expectInvalid(data);
  });

  it("rejects r.requires_r", () => {
    const data = baseConfig("connect_cloud");
    setNested(data, ["r"], "requires_r", ">=4.2");
    expectInvalid(data);
  });

  it("rejects r.package_file", () => {
    const data = baseConfig("connect_cloud");
    setNested(data, ["r"], "package_file", "renv.lock");
    expectInvalid(data);
  });

  it("rejects r.package_manager", () => {
    const data = baseConfig("connect_cloud");
    setNested(data, ["r"], "package_manager", "renv");
    expectInvalid(data);
  });

  it("rejects connect_cloud.garbage", () => {
    const data = baseConfig("connect_cloud");
    setNested(data, ["connect_cloud"], "garbage", "value");
    expectInvalid(data);
  });

  it("rejects connect_cloud.python.garbage", () => {
    const data = baseConfig("connect_cloud");
    setNested(data, ["connect_cloud", "python"], "garbage", "value");
    expectInvalid(data);
  });

  it("rejects connect_cloud.r.garbage", () => {
    const data = baseConfig("connect_cloud");
    setNested(data, ["connect_cloud", "r"], "garbage", "value");
    expectInvalid(data);
  });

  it("rejects connect_cloud.access_control.garbage", () => {
    const data = baseConfig("connect_cloud");
    setNested(data, ["connect_cloud", "access_control"], "garbage", "value");
    expectInvalid(data);
  });

  it("rejects jupyter section", () => {
    const data = baseConfig("connect_cloud");
    data.jupyter = {};
    expectInvalid(data);
  });

  it("rejects quarto section", () => {
    const data = baseConfig("connect_cloud");
    data.quarto = {};
    expectInvalid(data);
  });

  it("rejects has_parameters", () => {
    const data = baseConfig("connect_cloud");
    data.has_parameters = true;
    expectInvalid(data);
  });

  it("rejects connect.kubernetes", () => {
    const data = baseConfig("connect_cloud");
    data.connect = { kubernetes: {} };
    expectInvalid(data);
  });
});
