// Copyright (C) 2025 by Posit Software, PBC.

import { describe, expect, test } from "vitest";
import {
  RConfig,
  PythonConfig,
  Configuration,
  UpdateConfigWithDefaults,
  UpdateAllConfigsWithDefaults,
} from "./configurations";
import { InterpreterDefaults } from "./interpreters";
import {
  configurationFactory,
  interpreterDefaultsFactory,
} from "src/test/unit-test-utils/factories";

const interpreterDefaults: InterpreterDefaults =
  interpreterDefaultsFactory.build();
const blankIntprConf = {
  version: "",
  packageFile: "",
  packageManager: "",
};

describe("Configurations Types", () => {
  describe("UpdateConfigWithDefaults", () => {
    test("No R and no Python sections in config, no need to fill in anything", () => {
      const config: Configuration = configurationFactory.build();
      expect(config.configuration.r).toEqual(undefined);
      expect(config.configuration.python).toEqual(undefined);

      UpdateConfigWithDefaults(config, interpreterDefaults);
      expect(config.configuration.r).toEqual(undefined);
      expect(config.configuration.python).toEqual(undefined);
    });

    test("Existing R and Python sections in config are filled up with defaults", () => {
      const config: Configuration = configurationFactory.build();

      config.configuration.r = { ...blankIntprConf };
      config.configuration.python = { ...blankIntprConf };

      UpdateConfigWithDefaults(config, interpreterDefaults);
      expect(config.configuration.r).toEqual({
        version: "4.4.0",
        packageFile: "renv.lock",
        packageManager: "renv",
        requiresR: ">= 4.4.0",
      });
      expect(config.configuration.python).toEqual({
        version: "3.11.0",
        packageFile: "requirements.txt",
        packageManager: "pip",
        requiresPython: ">=3.11",
      });
    });

    test.each([
      // version, packageFile, packageManager
      ["", "custom_pack_file", "custom_pack_man"],
      ["3.6.0", "", "custom_pack_man"],
      ["3.6.0", "custom_pack_file", ""],
    ])(
      `When version is "%s", packageFile "%s" and packageManager is "%s", existing interpreter values are respected, only empty values are filled up`,
      (version: string, packFile: string, packMan: string) => {
        const config: Configuration = configurationFactory.build();

        const incomingIntprConfig = {
          version: version,
          packageFile: packFile,
          packageManager: packMan,
        };

        config.configuration.r = { ...incomingIntprConfig };
        config.configuration.python = { ...incomingIntprConfig };

        UpdateConfigWithDefaults(config, interpreterDefaults);

        const expectedRConf: RConfig = {
          ...incomingIntprConfig,
          requiresR: ">= 4.4.0",
        };
        const expectedPythonConf: PythonConfig = {
          ...incomingIntprConfig,
          requiresPython: ">=3.11",
        };

        if (version === "") {
          expectedRConf.version = "4.4.0";
          expectedPythonConf.version = "3.11.0";
        }

        if (packFile === "") {
          expectedRConf.packageFile = "renv.lock";
          expectedPythonConf.packageFile = "requirements.txt";
        }

        if (packMan === "") {
          expectedRConf.packageManager = "renv";
          expectedPythonConf.packageManager = "pip";
        }

        expect(config.configuration.r).toEqual(expectedRConf);
        expect(config.configuration.python).toEqual(expectedPythonConf);
      },
    );

    test("fills in requiresPython from defaults when config has no requiresPython", () => {
      const config: Configuration = configurationFactory.build();
      config.configuration.python = { ...blankIntprConf };

      UpdateConfigWithDefaults(config, interpreterDefaults);
      expect(config.configuration.python!.requiresPython).toBe(">=3.11");
    });

    test("preserves existing requiresPython when already set", () => {
      const config: Configuration = configurationFactory.build();
      config.configuration.python = {
        ...blankIntprConf,
        requiresPython: ">=3.9,<4",
      };

      UpdateConfigWithDefaults(config, interpreterDefaults);
      expect(config.configuration.python!.requiresPython).toBe(">=3.9,<4");
    });

    test("fills in requiresR from defaults when config has no requiresR", () => {
      const config: Configuration = configurationFactory.build();
      config.configuration.r = { ...blankIntprConf };

      UpdateConfigWithDefaults(config, interpreterDefaults);
      expect(config.configuration.r!.requiresR).toBe(">= 4.4.0");
    });

    test("preserves existing requiresR when already set", () => {
      const config: Configuration = configurationFactory.build();
      config.configuration.r = {
        ...blankIntprConf,
        requiresR: ">= 4.1.0",
      };

      UpdateConfigWithDefaults(config, interpreterDefaults);
      expect(config.configuration.r!.requiresR).toBe(">= 4.1.0");
    });

    test("does not set requiresPython when defaults have no requiresPython", () => {
      const config: Configuration = configurationFactory.build();
      config.configuration.python = { ...blankIntprConf };

      const defaultsWithoutRequires: InterpreterDefaults = {
        ...interpreterDefaults,
        python: {
          version: "3.11.0",
          packageFile: "requirements.txt",
          packageManager: "pip",
        },
      };

      UpdateConfigWithDefaults(config, defaultsWithoutRequires);
      expect(config.configuration.python!.requiresPython).toBeUndefined();
    });

    test("does not set requiresR when defaults have no requiresR", () => {
      const config: Configuration = configurationFactory.build();
      config.configuration.r = { ...blankIntprConf };

      const defaultsWithoutRequires: InterpreterDefaults = {
        ...interpreterDefaults,
        r: {
          version: "4.4.0",
          packageFile: "renv.lock",
          packageManager: "renv",
        },
      };

      UpdateConfigWithDefaults(config, defaultsWithoutRequires);
      expect(config.configuration.r!.requiresR).toBeUndefined();
    });
  });

  describe("UpdateAllConfigsWithDefaults", () => {
    test("updates all configs passed to it", () => {
      const multiConfigs: Configuration[] = [];

      for (let index = 0; index < 5; index++) {
        const cf = configurationFactory.build();
        cf.configuration.r = { ...blankIntprConf };
        cf.configuration.python = { ...blankIntprConf };
        multiConfigs.push(cf);
      }
      multiConfigs.forEach((cf) => {
        expect(cf.configuration.r).toEqual(blankIntprConf);
        expect(cf.configuration.python).toEqual(blankIntprConf);
      });

      UpdateAllConfigsWithDefaults(multiConfigs, interpreterDefaults);
      multiConfigs.forEach((cf) => {
        expect(cf.configuration.r).toEqual({
          version: "4.4.0",
          packageFile: "renv.lock",
          packageManager: "renv",
          requiresR: ">= 4.4.0",
        });
        expect(cf.configuration.python).toEqual({
          version: "3.11.0",
          packageFile: "requirements.txt",
          packageManager: "pip",
          requiresPython: ">=3.11",
        });
      });
    });
  });
});
