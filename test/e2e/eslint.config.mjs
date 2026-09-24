import globals from "globals";
import { defineConfig } from "eslint/config";
import js from "@eslint/js";
import pluginCypress from "eslint-plugin-cypress";
import pluginMocha from "eslint-plugin-mocha";
import eslintConfigPrettier from "eslint-config-prettier";

export default defineConfig([
  js.configs.recommended,
  pluginMocha.configs.recommended,
  pluginCypress.configs.recommended,
  { files: ["**/*.{js,mjs,cjs,ts}"] },
  {
    languageOptions: {
      globals: { ...globals.node },
      ecmaVersion: "latest",
      sourceType: "module",
    },
    rules: {
      semi: "error",
      "mocha/no-mocha-arrows": "off",
      "mocha/no-exclusive-tests": "error",
      // Disabling no-async-in-sync-tests
      // Added in eslint-plugin-mocha 12.0.0. It doesn't recognize Cypress's chainable
      // command queue, so it flags nearly every existing spec's cy.*().then() usage.
      "mocha/no-async-in-sync-tests": "off",
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.object.name='cy'][callee.property.name='pause']",
          message: "cy.pause() should not be used in committed code",
        },
      ],
    },
  },
  eslintConfigPrettier,
]);
