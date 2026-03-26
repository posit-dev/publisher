// Copyright (C) 2026 by Posit Software, PBC.

import { describe, expect, it } from "vitest";
import { connectContentFromConfig } from "./connectContentFromConfig";
import { ConfigurationDetails, ContentType } from "../api/types/configurations";
import { ProductType } from "../api/types/contentRecords";

function cfg(overrides: Partial<ConfigurationDetails>): ConfigurationDetails {
  return {
    $schema: "" as ConfigurationDetails["$schema"],
    productType: ProductType.CONNECT,
    type: ContentType.UNKNOWN,
    validate: true,
    ...overrides,
  };
}

describe("connectContentFromConfig", () => {
  it("minimal config with no connect block", () => {
    const result = connectContentFromConfig(cfg({}));
    expect(result).toEqual({ name: "" });
  });

  it("maps title and description", () => {
    const result = connectContentFromConfig(
      cfg({ title: "My App", description: "A great app" }),
    );
    expect(result).toEqual({
      name: "",
      title: "My App",
      description: "A great app",
    });
  });

  it("omits empty title and description", () => {
    const result = connectContentFromConfig(
      cfg({ title: "", description: "" }),
    );
    expect(result).toEqual({ name: "" });
  });

  it("maps runtime fields", () => {
    const result = connectContentFromConfig(
      cfg({
        connect: {
          runtime: {
            connectionTimeout: 10,
            readTimeout: 20,
            initTimeout: 30,
            idleTimeout: 40,
            maxProcesses: 5,
            minProcesses: 1,
            maxConnsPerProcess: 50,
            loadFactor: 0.75,
          },
        },
      }),
    );
    expect(result).toEqual({
      name: "",
      connection_timeout: 10,
      read_timeout: 20,
      init_timeout: 30,
      idle_timeout: 40,
      max_processes: 5,
      min_processes: 1,
      max_conns_per_process: 50,
      load_factor: 0.75,
    });
  });

  it("maps access fields", () => {
    const result = connectContentFromConfig(
      cfg({
        connect: {
          access: {
            runAs: "rstudio-connect",
            runAsCurrentUser: true,
          },
        },
      }),
    );
    expect(result).toEqual({
      name: "",
      run_as: "rstudio-connect",
      run_as_current_user: true,
    });
  });

  it("maps kubernetes fields", () => {
    const result = connectContentFromConfig(
      cfg({
        connect: {
          kubernetes: {
            memoryRequest: 1024,
            memoryLimit: 2048,
            cpuRequest: 0.5,
            cpuLimit: 2.0,
            amdGpuLimit: 1,
            nvidiaGpuLimit: 2,
            serviceAccountName: "my-sa",
            defaultImageName: "my-image:latest",
            defaultREnvironmentManagement: true,
            defaultPyEnvironmentManagement: false,
          },
        },
      }),
    );
    expect(result).toEqual({
      name: "",
      memory_request: 1024,
      memory_limit: 2048,
      cpu_request: 0.5,
      cpu_limit: 2.0,
      amd_gpu_limit: 1,
      nvidia_gpu_limit: 2,
      service_account_name: "my-sa",
      default_image_name: "my-image:latest",
      default_r_environment_management: true,
      default_py_environment_management: false,
    });
  });

  it("preserves zero values for numbers", () => {
    const result = connectContentFromConfig(
      cfg({
        connect: {
          runtime: {
            connectionTimeout: 0,
            minProcesses: 0,
            loadFactor: 0,
          },
        },
      }),
    );
    expect(result.connection_timeout).toBe(0);
    expect(result.min_processes).toBe(0);
    expect(result.load_factor).toBe(0);
  });

  it("preserves false for booleans", () => {
    const result = connectContentFromConfig(
      cfg({
        connect: {
          access: { runAsCurrentUser: false },
          kubernetes: {
            defaultREnvironmentManagement: false,
            defaultPyEnvironmentManagement: false,
          },
        },
      }),
    );
    expect(result.run_as_current_user).toBe(false);
    expect(result.default_r_environment_management).toBe(false);
    expect(result.default_py_environment_management).toBe(false);
  });

  it("access with runAs only, no runAsCurrentUser", () => {
    const result = connectContentFromConfig(
      cfg({
        connect: {
          access: { runAs: "publisher" },
        },
      }),
    );
    expect(result.run_as).toBe("publisher");
    expect(result.run_as_current_user).toBeUndefined();
    // Verify it's omitted from JSON, not sent as null
    const json = JSON.parse(JSON.stringify(result));
    expect("run_as_current_user" in json).toBe(false);
  });

  it("omits empty kubernetes string fields", () => {
    const result = connectContentFromConfig(
      cfg({
        connect: {
          kubernetes: {
            memoryRequest: 512,
            serviceAccountName: "",
            defaultImageName: "",
          },
        },
      }),
    );
    expect(result.memory_request).toBe(512);
    const json = JSON.parse(JSON.stringify(result));
    expect("service_account_name" in json).toBe(false);
    expect("default_image_name" in json).toBe(false);
  });

  it("handles partial connect sections", () => {
    const result = connectContentFromConfig(
      cfg({
        title: "Partial",
        connect: {
          runtime: { initTimeout: 60 },
          // access and kubernetes absent
        },
      }),
    );
    expect(result).toEqual({
      name: "",
      title: "Partial",
      init_timeout: 60,
    });
  });
});
