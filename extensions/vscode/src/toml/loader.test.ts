// Copyright (C) 2026 by Posit Software, PBC.

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadConfigFromFile } from "./loader";
import {
  isConfigurationError,
  UpdateConfigWithDefaults,
} from "../api/types/configurations";
import { ConfigurationLoadError } from "./errors";
import { interpreterDefaultsFactory } from "../test/unit-test-utils/factories";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "config-loader-test-"));
  fs.mkdirSync(path.join(tmpDir, ".posit", "publish"), { recursive: true });
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeConfig(name: string, content: string): string {
  const configPath = path.join(tmpDir, ".posit", "publish", `${name}.toml`);
  fs.writeFileSync(configPath, content, "utf-8");
  return configPath;
}

describe("loadConfigFromFile", () => {
  it("loads a valid config with all Connect sections", async () => {
    const configPath = writeConfig(
      "myapp",
      `
"$schema" = "https://cdn.posit.co/publisher/schemas/posit-publishing-schema-v3.json"
type = "python-dash"
entrypoint = "app.py"
title = "My App"
validate = true
has_parameters = false
files = ["app.py", "requirements.txt"]
secrets = ["API_KEY"]

[python]
version = "3.11.3"
package_file = "requirements.txt"
package_manager = "pip"
requires_python = ">=3.11"

[r]
version = "4.3.1"
package_file = "renv.lock"
package_manager = "renv"
requires_r = ">=4.3"
packages_from_library = false

[jupyter]
hide_all_input = true
hide_tagged_input = false

[environment]
MY_API_KEY = "not-a-secret"
DATABASE_URL = "postgres://localhost/db"

[connect.runtime]
connection_timeout = 5
max_conns_per_process = 50
load_factor = 0.5

[connect.kubernetes]
default_image_name = "posit/connect-runtime-python3.11-r4.3"
cpu_limit = 2.0
memory_limit = 100000000
default_r_environment_management = true
default_py_environment_management = false
`,
    );

    const cfg = await loadConfigFromFile(configPath, tmpDir);

    expect(cfg.configuration.$schema).toBe(
      "https://cdn.posit.co/publisher/schemas/posit-publishing-schema-v3.json",
    );
    expect(cfg.configuration.type).toBe("python-dash");
    expect(cfg.configuration.entrypoint).toBe("app.py");
    expect(cfg.configuration.title).toBe("My App");
    expect(cfg.configuration.hasParameters).toBe(false);
    expect(cfg.configuration.validate).toBe(true);
    expect(cfg.configuration.secrets).toEqual(["API_KEY"]);

    // Python
    expect(cfg.configuration.python?.version).toBe("3.11.3");
    expect(cfg.configuration.python?.packageFile).toBe("requirements.txt");
    expect(cfg.configuration.python?.packageManager).toBe("pip");
    expect(cfg.configuration.python?.requiresPython).toBe(">=3.11");

    // R
    expect(cfg.configuration.r?.version).toBe("4.3.1");
    expect(cfg.configuration.r?.packageFile).toBe("renv.lock");
    expect(cfg.configuration.r?.requiresR).toBe(">=4.3");
    expect(cfg.configuration.r?.packagesFromLibrary).toBe(false);

    // Jupyter
    expect(cfg.configuration.jupyter?.hideAllInput).toBe(true);
    expect(cfg.configuration.jupyter?.hideTaggedInput).toBe(false);

    // Environment keys preserved as-is
    expect(cfg.configuration.environment).toEqual({
      MY_API_KEY: "not-a-secret",
      DATABASE_URL: "postgres://localhost/db",
    });

    // Connect runtime
    expect(cfg.configuration.connect?.runtime?.connectionTimeout).toBe(5);
    expect(cfg.configuration.connect?.runtime?.maxConnsPerProcess).toBe(50);
    expect(cfg.configuration.connect?.runtime?.loadFactor).toBe(0.5);

    // Connect kubernetes
    expect(cfg.configuration.connect?.kubernetes?.defaultImageName).toBe(
      "posit/connect-runtime-python3.11-r4.3",
    );
    expect(cfg.configuration.connect?.kubernetes?.cpuLimit).toBe(2.0);
    expect(
      cfg.configuration.connect?.kubernetes?.defaultREnvironmentManagement,
    ).toBe(true);
    expect(
      cfg.configuration.connect?.kubernetes?.defaultPyEnvironmentManagement,
    ).toBe(false);
  });

  it("loads the example config.toml", async () => {
    const examplePath = path.resolve(__dirname, "schemas/example-config.toml");
    const projectDir = path.dirname(examplePath);

    const cfg = await loadConfigFromFile(examplePath, projectDir);

    expect(cfg.configuration.type).toBe("quarto-static");
    expect(cfg.configuration.entrypoint).toBe("report.qmd");
    expect(cfg.configuration.productType).toBe("connect");
    expect(
      cfg.configuration.connect?.kubernetes?.defaultPyEnvironmentManagement,
    ).toBe(true);
    expect(cfg.configuration.connect?.access?.runAs).toBe("rstudio-connect");
  });

  it("loads a valid config with integration_requests", async () => {
    const configPath = writeConfig(
      "with-integrations",
      `
"$schema" = "https://cdn.posit.co/publisher/schemas/posit-publishing-schema-v3.json"
type = "python-dash"
entrypoint = "app.py"

[python]
version = "3.11"

[[integration_requests]]
guid = "12345678-1234-1234-1234-1234567890ab"
name = "My Integration"
description = "A test integration"
auth_type = "oauth"
type = "databricks"

[integration_requests.config]
custom_key = "custom_value"
ANOTHER_KEY = "another_value"
`,
    );

    const cfg = await loadConfigFromFile(configPath, tmpDir);

    expect(cfg.configuration.integrationRequests).toHaveLength(1);
    const ir = cfg.configuration.integrationRequests![0]!;
    expect(ir.guid).toBe("12345678-1234-1234-1234-1234567890ab");
    expect(ir.name).toBe("My Integration");
    expect(ir.description).toBe("A test integration");
    expect(ir.authType).toBe("oauth");
    expect(ir.type).toBe("databricks");
    expect(ir.config).toEqual({
      custom_key: "custom_value",
      ANOTHER_KEY: "another_value",
    });
  });

  it("loads a valid Connect Cloud config", async () => {
    const configPath = writeConfig(
      "cloud",
      `
"$schema" = "https://cdn.posit.co/publisher/schemas/posit-publishing-schema-v3.json"
type = "python-dash"
entrypoint = "app.py"
product_type = "connect_cloud"

[python]
version = "3.11"

[connect_cloud]
vanity_name = "my-app"

[connect_cloud.access_control]
public_access = true
organization_access = "viewer"
`,
    );

    const cfg = await loadConfigFromFile(configPath, tmpDir);

    expect(cfg.configuration.productType).toBe("connect_cloud");
    expect(cfg.configuration.connectCloud?.vanityName).toBe("my-app");
    expect(cfg.configuration.connectCloud?.accessControl?.publicAccess).toBe(
      true,
    );
    expect(
      cfg.configuration.connectCloud?.accessControl?.organizationAccess,
    ).toBe("viewer");
  });

  it("throws ConfigurationLoadError for invalid TOML syntax", async () => {
    const configPath = writeConfig("bad-toml", "this is not valid toml [[[");

    try {
      await loadConfigFromFile(configPath, tmpDir);
      expect.fail("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigurationLoadError);
      if (error instanceof ConfigurationLoadError) {
        expect(error.configurationError.error.code).toBe("invalidTOML");
        expect(error.configurationError.configurationName).toBe("bad-toml");
      }
    }
  });

  it("throws ConfigurationLoadError for schema validation failure", async () => {
    const configPath = writeConfig(
      "invalid-schema",
      'title = "Missing required fields"',
    );

    try {
      await loadConfigFromFile(configPath, tmpDir);
      expect.fail("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigurationLoadError);
      if (error instanceof ConfigurationLoadError) {
        expect(error.configurationError.error.code).toBe("tomlValidationError");
      }
    }
  });

  it("throws ENOENT for missing file", async () => {
    const missingPath = path.join(tmpDir, ".posit", "publish", "nope.toml");
    await expect(loadConfigFromFile(missingPath, tmpDir)).rejects.toThrow(
      /ENOENT/,
    );
  });

  it("ENOENT is not a ConfigurationLoadError", async () => {
    const missingPath = path.join(tmpDir, ".posit", "publish", "nope.toml");
    try {
      await loadConfigFromFile(missingPath, tmpDir);
      expect.fail("should have thrown");
    } catch (error) {
      expect(error).not.toBeInstanceOf(ConfigurationLoadError);
    }
  });

  it("sets correct location metadata", async () => {
    const configPath = writeConfig(
      "location-test",
      `
"$schema" = "https://cdn.posit.co/publisher/schemas/posit-publishing-schema-v3.json"
type = "html"
entrypoint = "index.html"
`,
    );

    const cfg = await loadConfigFromFile(configPath, tmpDir);
    expect(cfg.configurationName).toBe("location-test");
    expect(cfg.configurationPath).toBe(configPath);
    expect(cfg.projectDir).toBe(tmpDir);
  });

  it("reads leading comments from the file", async () => {
    const configPath = writeConfig(
      "with-comments",
      `# This is a comment
# Another comment line
"$schema" = "https://cdn.posit.co/publisher/schemas/posit-publishing-schema-v3.json"
type = "html"
entrypoint = "index.html"
`,
    );

    const cfg = await loadConfigFromFile(configPath, tmpDir);
    expect(cfg.configuration.comments).toEqual([
      " This is a comment",
      " Another comment line",
    ]);
  });

  it("returns empty comments array when no leading comments", async () => {
    const configPath = writeConfig(
      "no-comments",
      `"$schema" = "https://cdn.posit.co/publisher/schemas/posit-publishing-schema-v3.json"
type = "html"
entrypoint = "index.html"
`,
    );

    const cfg = await loadConfigFromFile(configPath, tmpDir);
    expect(cfg.configuration.comments).toEqual([]);
  });

  it("only reads comments from the top of the file", async () => {
    const configPath = writeConfig(
      "mid-comments",
      `# Leading comment
"$schema" = "https://cdn.posit.co/publisher/schemas/posit-publishing-schema-v3.json"
# This is a mid-file comment (should not be captured)
type = "html"
entrypoint = "index.html"
`,
    );

    const cfg = await loadConfigFromFile(configPath, tmpDir);
    expect(cfg.configuration.comments).toEqual([" Leading comment"]);
  });

  it("defaults productType to 'connect' when not specified", async () => {
    const configPath = writeConfig(
      "default-product",
      `
"$schema" = "https://cdn.posit.co/publisher/schemas/posit-publishing-schema-v3.json"
type = "html"
entrypoint = "index.html"
`,
    );

    const cfg = await loadConfigFromFile(configPath, tmpDir);
    expect(cfg.configuration.productType).toBe("connect");
  });

  it("applies defaults for validate and files", async () => {
    const configPath = writeConfig(
      "defaults-test",
      `
"$schema" = "https://cdn.posit.co/publisher/schemas/posit-publishing-schema-v3.json"
type = "html"
entrypoint = "index.html"
`,
    );

    const cfg = await loadConfigFromFile(configPath, tmpDir);
    expect(cfg.configuration.validate).toBe(true);
    expect(cfg.configuration.files).toEqual([]);
  });

  it("throws for Connect Cloud config with unsupported content type", async () => {
    const configPath = writeConfig(
      "cloud-flask",
      `
"$schema" = "https://cdn.posit.co/publisher/schemas/posit-publishing-schema-v3.json"
type = "python-flask"
entrypoint = "app.py"
product_type = "connect_cloud"

[python]
version = "3.11"
`,
    );

    try {
      await loadConfigFromFile(configPath, tmpDir);
      expect.fail("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigurationLoadError);
      if (error instanceof ConfigurationLoadError) {
        expect(error.configurationError.error.code).toBe("tomlValidationError");
        expect(error.message).toContain("python-flask");
        expect(error.message).toContain("not supported by Connect Cloud");
      }
    }
  });

  it("accepts Connect Cloud config with supported content type", async () => {
    const configPath = writeConfig(
      "cloud-dash",
      `
"$schema" = "https://cdn.posit.co/publisher/schemas/posit-publishing-schema-v3.json"
type = "python-dash"
entrypoint = "app.py"
product_type = "connect_cloud"

[python]
version = "3.11"
`,
    );

    const cfg = await loadConfigFromFile(configPath, tmpDir);
    expect(cfg.configuration.type).toBe("python-dash");
    expect(cfg.configuration.productType).toBe("connect_cloud");
  });

  it("does not override explicit validate=false", async () => {
    const configPath = writeConfig(
      "validate-false",
      `
"$schema" = "https://cdn.posit.co/publisher/schemas/posit-publishing-schema-v3.json"
type = "html"
entrypoint = "index.html"
validate = false
`,
    );

    const cfg = await loadConfigFromFile(configPath, tmpDir);
    expect(cfg.configuration.validate).toBe(false);
  });
});

describe("downstream compatibility", () => {
  it("loader output works with UpdateConfigWithDefaults", async () => {
    const configPath = writeConfig(
      "defaults-compat",
      `
"$schema" = "https://cdn.posit.co/publisher/schemas/posit-publishing-schema-v3.json"
type = "python-dash"
entrypoint = "app.py"

[python]
version = "3.11"
`,
    );

    const cfg = await loadConfigFromFile(configPath, tmpDir);

    const defaults = interpreterDefaultsFactory.build();
    const updated = UpdateConfigWithDefaults(cfg, defaults);

    expect(isConfigurationError(updated)).toBe(false);
    if (!isConfigurationError(updated)) {
      expect(updated.configuration.python?.version).toBe("3.11");
      expect(updated.configuration.python?.packageFile).toBe(
        defaults.python.packageFile,
      );
      expect(updated.configuration.python?.packageManager).toBe(
        defaults.python.packageManager,
      );
    }
  });

  it("ConfigurationLoadError carries location metadata", async () => {
    const configPath = writeConfig("meta-test", "not valid toml [[[");

    try {
      await loadConfigFromFile(configPath, tmpDir);
      expect.fail("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigurationLoadError);
      if (error instanceof ConfigurationLoadError) {
        expect(error.configurationError.configurationName).toBe("meta-test");
        expect(error.configurationError.configurationPath).toBe(configPath);
        expect(error.configurationError.projectDir).toBe(tmpDir);
      }
    }
  });
});
