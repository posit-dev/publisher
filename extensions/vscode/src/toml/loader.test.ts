// Copyright (C) 2026 by Posit Software, PBC.

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadConfigFromFile } from "./loader";
import {
  Configuration,
  ConfigurationError,
  isConfigurationError,
  UpdateConfigWithDefaults,
} from "../api/types/configurations";
import { filterConfigurationsToValidAndType } from "../utils/filters";
import { ContentType } from "../api/types/configurations";
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

    const result = await loadConfigFromFile(configPath, tmpDir);
    expect(isConfigurationError(result)).toBe(false);
    const cfg = result as Configuration;

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
    // Mirrors Go's TestFromExampleFile — loads the real example config
    // to catch drift between the schema and the example file.
    const examplePath = path.resolve(__dirname, "schemas/example-config.toml");
    const projectDir = path.dirname(examplePath);

    const result = await loadConfigFromFile(examplePath, projectDir);
    expect(isConfigurationError(result)).toBe(false);
    const cfg = result as Configuration;

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

    const result = await loadConfigFromFile(configPath, tmpDir);
    expect(isConfigurationError(result)).toBe(false);
    const cfg = result as Configuration;

    expect(cfg.configuration.integrationRequests).toHaveLength(1);
    const ir = cfg.configuration.integrationRequests![0]!;
    expect(ir.guid).toBe("12345678-1234-1234-1234-1234567890ab");
    expect(ir.name).toBe("My Integration");
    expect(ir.description).toBe("A test integration");
    expect(ir.authType).toBe("oauth");
    expect(ir.type).toBe("databricks");
    // Config keys should be preserved as-is (user-defined)
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

    const result = await loadConfigFromFile(configPath, tmpDir);
    expect(isConfigurationError(result)).toBe(false);
    const cfg = result as Configuration;

    expect(cfg.configuration.productType).toBe("connect_cloud");
    expect(cfg.configuration.connectCloud?.vanityName).toBe("my-app");
    expect(cfg.configuration.connectCloud?.accessControl?.publicAccess).toBe(
      true,
    );
    expect(
      cfg.configuration.connectCloud?.accessControl?.organizationAccess,
    ).toBe("viewer");
  });

  it("returns ConfigurationError for invalid TOML syntax", async () => {
    const configPath = writeConfig(
      "bad-toml",
      `
this is not valid toml [[[
`,
    );

    const result = await loadConfigFromFile(configPath, tmpDir);
    expect(isConfigurationError(result)).toBe(true);
    const err = result as ConfigurationError;
    expect(err.error.code).toBe("invalidTOML");
    expect(err.configurationName).toBe("bad-toml");
  });

  it("returns ConfigurationError for schema validation failure", async () => {
    // Missing required fields ($schema, type, entrypoint)
    const configPath = writeConfig(
      "invalid-schema",
      `
title = "Missing required fields"
`,
    );

    const result = await loadConfigFromFile(configPath, tmpDir);
    expect(isConfigurationError(result)).toBe(true);
    const err = result as ConfigurationError;
    expect(err.error.code).toBe("tomlValidationError");
  });

  it("throws ENOENT for missing file", async () => {
    const missingPath = path.join(tmpDir, ".posit", "publish", "nope.toml");
    await expect(loadConfigFromFile(missingPath, tmpDir)).rejects.toThrow(
      /ENOENT/,
    );
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

    const result = await loadConfigFromFile(configPath, tmpDir);
    expect(result.configurationName).toBe("location-test");
    expect(result.configurationPath).toBe(configPath);
    expect(result.projectDir).toBe(tmpDir);
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

    const result = await loadConfigFromFile(configPath, tmpDir);
    expect(isConfigurationError(result)).toBe(false);
    const cfg = result as Configuration;
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

    const result = await loadConfigFromFile(configPath, tmpDir);
    expect(isConfigurationError(result)).toBe(false);
    const cfg = result as Configuration;
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

    const result = await loadConfigFromFile(configPath, tmpDir);
    expect(isConfigurationError(result)).toBe(false);
    const cfg = result as Configuration;
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

    const result = await loadConfigFromFile(configPath, tmpDir);
    expect(isConfigurationError(result)).toBe(false);
    const cfg = result as Configuration;
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

    const result = await loadConfigFromFile(configPath, tmpDir);
    expect(isConfigurationError(result)).toBe(false);
    const cfg = result as Configuration;

    // validate defaults to true (matches Go New())
    expect(cfg.configuration.validate).toBe(true);
    // files defaults to empty array (matches Go New())
    expect(cfg.configuration.files).toEqual([]);
  });

  it("rejects Connect Cloud config with unsupported content type", async () => {
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

    const result = await loadConfigFromFile(configPath, tmpDir);
    expect(isConfigurationError(result)).toBe(true);
    const err = result as ConfigurationError;
    expect(err.error.code).toBe("tomlValidationError");
    expect(err.error.msg).toContain("python-flask");
    expect(err.error.msg).toContain("not supported by Connect Cloud");
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

    const result = await loadConfigFromFile(configPath, tmpDir);
    expect(isConfigurationError(result)).toBe(false);
    const cfg = result as Configuration;
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

    const result = await loadConfigFromFile(configPath, tmpDir);
    expect(isConfigurationError(result)).toBe(false);
    const cfg = result as Configuration;
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

    const result = await loadConfigFromFile(configPath, tmpDir);
    expect(isConfigurationError(result)).toBe(false);

    const defaults = interpreterDefaultsFactory.build();
    const updated = UpdateConfigWithDefaults(result as Configuration, defaults);

    const cfg = updated as Configuration;
    // Python version was set in the TOML, so it shouldn't be overwritten by defaults
    expect(cfg.configuration.python?.version).toBe("3.11");
    // packageFile and packageManager were not set, so they should be filled from defaults
    expect(cfg.configuration.python?.packageFile).toBe(
      defaults.python.packageFile,
    );
    expect(cfg.configuration.python?.packageManager).toBe(
      defaults.python.packageManager,
    );
  });

  it("isConfigurationError works on both valid and error results", async () => {
    const validPath = writeConfig(
      "valid",
      `
"$schema" = "https://cdn.posit.co/publisher/schemas/posit-publishing-schema-v3.json"
type = "html"
entrypoint = "index.html"
`,
    );
    const badPath = writeConfig("bad", "not valid toml [[[");

    const valid = await loadConfigFromFile(validPath, tmpDir);
    const bad = await loadConfigFromFile(badPath, tmpDir);

    expect(isConfigurationError(valid)).toBe(false);
    expect(isConfigurationError(bad)).toBe(true);
  });

  it("filterConfigurationsToValidAndType works with loader output", async () => {
    const htmlPath = writeConfig(
      "html-cfg",
      `
"$schema" = "https://cdn.posit.co/publisher/schemas/posit-publishing-schema-v3.json"
type = "html"
entrypoint = "index.html"
`,
    );
    const badPath = writeConfig("bad-cfg", "not valid [[[");

    const configs = await Promise.all([
      loadConfigFromFile(htmlPath, tmpDir),
      loadConfigFromFile(badPath, tmpDir),
    ]);

    const valid = filterConfigurationsToValidAndType(configs, ContentType.HTML);
    expect(valid).toHaveLength(1);
    expect(valid[0]!.configuration.type).toBe("html");
  });

  it(".configurationName is accessible on both valid and error results", async () => {
    const validPath = writeConfig(
      "accessible-valid",
      `
"$schema" = "https://cdn.posit.co/publisher/schemas/posit-publishing-schema-v3.json"
type = "html"
entrypoint = "index.html"
`,
    );
    const badPath = writeConfig("accessible-bad", "not valid [[[");

    const results = await Promise.all([
      loadConfigFromFile(validPath, tmpDir),
      loadConfigFromFile(badPath, tmpDir),
    ]);

    const names = results.map((c) => c.configurationName);
    expect(names).toEqual(["accessible-valid", "accessible-bad"]);
  });
});
