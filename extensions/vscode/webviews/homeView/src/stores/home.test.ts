import { setActivePinia, createPinia } from "pinia";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { useHomeStore } from "src/stores/home";
import type {
  Configuration,
  ConfigurationError,
} from "../../../../src/api/types/configurations";
import type { PreContentRecord } from "../../../../src/api/types/contentRecords";
import {
  ContentRecordState,
  ServerType,
} from "../../../../src/api/types/contentRecords";

vi.mock("src/vscode", () => {
  const postMessage = vi.fn();
  const vscodeAPI = vi.fn(() => ({
    postMessage: postMessage,
  }));
  return { vscodeAPI };
});

// Helper to create a minimal PreContentRecord for testing
function makeContentRecord(
  overrides: Partial<PreContentRecord> = {},
): PreContentRecord {
  return {
    $schema: "" as any,
    serverType: ServerType.CONNECT,
    serverUrl: "https://connect.example.com",
    saveName: "test-deployment",
    createdAt: "",
    dismissedAt: "",
    configurationName: "default",
    type: "html" as any,
    deploymentError: null,
    connectCloud: null,
    deploymentName: "test-deployment",
    deploymentPath: "/path/to/deployment.toml",
    projectDir: ".",
    state: ContentRecordState.NEW,
    ...overrides,
  };
}

// Helper to create a valid Configuration
function makeConfiguration(
  overrides: Partial<Configuration> = {},
): Configuration {
  return {
    configurationName: "default",
    configurationPath: "/path/to/config.toml",
    configurationRelPath: ".posit/publish/default.toml",
    projectDir: ".",
    configuration: {
      $schema: "" as any,
      type: "html" as any,
      entrypoint: "index.html",
      title: "My App",
      files: ["/index.html"],
      validate: true,
      ...overrides.configuration,
    } as any,
    ...overrides,
  };
}

// Helper to create a ConfigurationError
function makeConfigurationError(
  overrides: Partial<ConfigurationError> = {},
): ConfigurationError {
  return {
    configurationName: "default",
    configurationPath: "/path/to/config.toml",
    configurationRelPath: ".posit/publish/default.toml",
    projectDir: ".",
    error: {
      code: "unknown" as any,
      msg: "some error",
      operation: "read",
      data: {},
    },
    ...overrides,
  };
}

describe("Home Store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  test("initializes with correct defaults", () => {
    const home = useHomeStore();
    expect(home.showDisabledOverlay).toBe(false);
  });

  describe("config.active error states", () => {
    test("isMissing is true when config file is not found", () => {
      const home = useHomeStore();

      // Set up a content record that references a config name
      const contentRecord = makeContentRecord({
        configurationName: "deleted-config",
      });
      home.contentRecords.push(contentRecord);
      home.selectedContentRecord = contentRecord;

      // Don't add any matching configuration or error — simulates deleted file
      expect(home.config.active.isMissing).toBe(true);
      expect(home.config.active.isAlertActive).toBe(true);
    });

    test("isMissing is false when config exists", () => {
      const home = useHomeStore();

      const contentRecord = makeContentRecord({
        configurationName: "default",
      });
      home.contentRecords.push(contentRecord);
      home.selectedContentRecord = contentRecord;

      // Add matching configuration
      home.configurations.push(makeConfiguration());

      expect(home.config.active.isMissing).toBe(false);
    });

    test("isTOMLError is true for invalidTOML config errors", () => {
      const home = useHomeStore();

      const contentRecord = makeContentRecord({
        configurationName: "broken-config",
      });
      home.contentRecords.push(contentRecord);
      home.selectedContentRecord = contentRecord;

      // Add a configuration error with invalidTOML code
      home.configurationsInError.push(
        makeConfigurationError({
          configurationName: "broken-config",
          error: {
            code: "invalidTOML" as any,
            msg: "invalid TOML syntax",
            operation: "read",
            data: {
              problem: "unexpected character",
              file: "default.toml",
              line: 5,
              column: 10,
            },
          },
        }),
      );

      expect(home.config.active.isTOMLError).toBe(true);
      expect(home.config.active.isAlertActive).toBe(true);
    });

    test("isTOMLError is true for unknownTOMLKey config errors", () => {
      const home = useHomeStore();

      const contentRecord = makeContentRecord({
        configurationName: "broken-config",
      });
      home.contentRecords.push(contentRecord);
      home.selectedContentRecord = contentRecord;

      home.configurationsInError.push(
        makeConfigurationError({
          configurationName: "broken-config",
          error: {
            code: "unknownTOMLKey" as any,
            msg: "invalidParam: not allowed",
            operation: "read",
            data: {
              problem: "invalidParam: not allowed",
              file: "default.toml",
              line: 3,
              column: 1,
            },
          },
        }),
      );

      expect(home.config.active.isTOMLError).toBe(true);
    });

    test("isUnknownError is true for non-TOML agent errors", () => {
      const home = useHomeStore();

      const contentRecord = makeContentRecord({
        configurationName: "error-config",
      });
      home.contentRecords.push(contentRecord);
      home.selectedContentRecord = contentRecord;

      home.configurationsInError.push(
        makeConfigurationError({
          configurationName: "error-config",
          error: {
            code: "unknown" as any,
            msg: "something went wrong",
            operation: "validate",
            data: { detail: "unexpected" },
          },
        }),
      );

      expect(home.config.active.isUnknownError).toBe(true);
      expect(home.config.active.isTOMLError).toBe(false);
      expect(home.config.active.isAlertActive).toBe(true);
    });

    test("isUnknownType is true when config type is unknown", () => {
      const home = useHomeStore();

      const contentRecord = makeContentRecord({
        configurationName: "unknown-type",
      });
      home.contentRecords.push(contentRecord);
      home.selectedContentRecord = contentRecord;

      home.configurations.push(
        makeConfiguration({
          configurationName: "unknown-type",
          configuration: {
            type: "unknown" as any,
            entrypoint: "unknown",
            title: "Unknown",
          } as any,
        }),
      );

      expect(home.config.active.isUnknownType).toBe(true);
    });

    test("isEntryMissing is true when content record has no config name", () => {
      const home = useHomeStore();

      const contentRecord = makeContentRecord({
        configurationName: "",
      });
      home.contentRecords.push(contentRecord);
      home.selectedContentRecord = contentRecord;

      expect(home.config.active.isEntryMissing).toBe(true);
      expect(home.config.active.isAlertActive).toBe(true);
    });

    test("no error states are active for a valid configuration", () => {
      const home = useHomeStore();

      const contentRecord = makeContentRecord();
      home.contentRecords.push(contentRecord);
      home.selectedContentRecord = contentRecord;
      home.configurations.push(makeConfiguration());

      // Add a credential so isCredentialMissing is also false
      home.credentials.push({
        name: "test-cred",
        url: "https://connect.example.com",
      } as any);

      expect(home.config.active.isMissing).toBe(false);
      expect(home.config.active.isTOMLError).toBe(false);
      expect(home.config.active.isUnknownError).toBe(false);
      expect(home.config.active.isUnknownType).toBe(false);
      expect(home.config.active.isEntryMissing).toBe(false);
    });
  });
});
