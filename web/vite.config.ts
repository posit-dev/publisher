/// <reference types="vitest" />

import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { quasar, transformAssetUrls } from "@quasar/vite-plugin";

const getVersion = (mode: string): string => {
  let version = execSync("git describe --tags").toString().trimEnd();
  if (mode === "development") {
    version += "-dev";
  }
  return JSON.stringify(version);
};

// https://vitejs.dev/config/
// eslint-disable-next-line no-restricted-syntax
export default defineConfig(({ mode }) => ({
  base: "/",
  build: {
    rollupOptions: {
      output: {
        // The default value is "assets/[name]-[hash][extname]". The [hash] pattern is removed in order to force a deterministic filename name when loading index.css and index.js from additional locations, such as the VSCode extension.
        assetFileNames: "assets/[name][extname]",
        chunkFileNames: "assets/[name].js",
        entryFileNames: "assets/[name].js",
      },
    },
  },
  define: {
    __VERSION__: getVersion(mode),
  },
  plugins: [
    vue({
      template: {
        transformAssetUrls,
        compilerOptions: {
          isCustomElement: (tag) => tag === "relative-time",
        },
      },
    }),
    quasar({
      sassVariables: "src/quasar-variables.sass",
    }),
  ],
  resolve: {
    alias: {
      src: fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  preview: {
    port: 9000,
  },
  server: {
    open: false,
    port: 9000,
    proxy: {
      // proxy all requests starting with /api to CLI
      "/api": {
        target: "http://127.0.0.1:9001",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  test: {
    environment: "jsdom",
  },
}));
