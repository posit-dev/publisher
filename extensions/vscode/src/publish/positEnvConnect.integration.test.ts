// Copyright (C) 2026 by Posit Software, PBC.
//
// End-to-end test of the posit-env publish flow against a live Connect:
// the real connectPublish() builds a manifest with environment
// management off, injects posit-env.json, uploads, deploys, and the
// Connect server's posit-env supervisor runs the content on the
// published environment. Requires the environment-manager-poc compose
// stack (Connect on :3939, posit-env server on :6464).
//
// Skipped unless configured:
//   POSIT_ENV_E2E_CONNECT_URL      e.g. http://localhost:3939
//   POSIT_ENV_E2E_CONNECT_API_KEY  admin API key
//   POSIT_ENV_E2E_REF              e.g. demo/dashboard-py:prod
//   POSIT_ENV_E2E_DIGEST           sha256:… (the ref's current lock)
//   POSIT_ENV_E2E_ENV_SERVER       posit-env URL as reachable FROM CONNECT
//                                  (e.g. http://server:6464)
//   POSIT_ENV_E2E_PYTHON_VERSION   exact x.y.z of the environment's python
//
// Run:
//   npx vitest run src/publish/positEnvConnect.integration.test.ts

import { promises as fs } from "fs";
import * as os from "os";
import * as path from "path";
import { describe, expect, test, vi } from "vitest";

vi.mock("../logging", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { ConnectAPI } from "@posit-dev/connect-api";
import {
  ContentType,
  type ConfigurationDetails,
} from "../api/types/configurations";
import { ProductType, ServerType } from "../api/types/contentRecords";
import { connectPublish } from "./connectPublish";
import type { PublishEvent } from "./publishShared";

const connectUrl = process.env.POSIT_ENV_E2E_CONNECT_URL;
const apiKey = process.env.POSIT_ENV_E2E_CONNECT_API_KEY;
const ref = process.env.POSIT_ENV_E2E_REF;
const digest = process.env.POSIT_ENV_E2E_DIGEST;
const envServer = process.env.POSIT_ENV_E2E_ENV_SERVER;
const pythonVersion = process.env.POSIT_ENV_E2E_PYTHON_VERSION;

const rRef = process.env.POSIT_ENV_E2E_R_REF;
const rDigest = process.env.POSIT_ENV_E2E_R_DIGEST;
const rVersion = process.env.POSIT_ENV_E2E_R_VERSION;

const configured = !!connectUrl && !!apiKey && !!ref && !!digest && !!envServer;
const rConfigured = configured && !!rRef && !!rDigest && !!rVersion;

const APP_PY = `from shiny import App, render, ui
import os
import pandas as pd

app_ui = ui.page_fluid(ui.h2("posit-env e2e"), ui.output_text("identity"))

def server(input, output, session):
    @output
    @render.text
    def identity():
        df = pd.DataFrame({"n": [1, 2, 3]})
        return "%s rows on %s" % (len(df), os.environ.get("POSIT_ENV_NAME", "?"))

app = App(app_ui, server)
`;

describe("posit-env → Connect end to end", { timeout: 300_000 }, () => {
  test.skipIf(!configured)(
    "publishes a python-shiny app that runs on the posit-env environment",
    async () => {
      const projectDir = await fs.mkdtemp(
        path.join(os.tmpdir(), "positenv-e2e-"),
      );
      await fs.writeFile(path.join(projectDir, "app.py"), APP_PY);

      const config: ConfigurationDetails = {
        $schema:
          "https://cdn.posit.co/publisher/schemas/posit-publishing-schema-v3.json",
        productType: ProductType.CONNECT,
        type: ContentType.PYTHON_SHINY,
        entrypoint: "app.py",
        title: "posit-env e2e dashboard",
        python: {
          version: pythonVersion || "",
          packageFile: "",
          packageManager: "auto",
        },
        validate: true,
        files: ["/app.py"],
      };

      const events: PublishEvent[] = [];
      const api = new ConnectAPI({ url: connectUrl!, apiKey: apiKey! });

      const result = await connectPublish({
        api,
        projectDir,
        saveName: "positenv-e2e",
        config,
        configName: "positenv-e2e.toml",
        serverUrl: connectUrl!,
        serverType: ServerType.CONNECT,
        positEnv: {
          ref: ref!,
          digest: digest!,
          envPath: "/posit/store/unused-in-e2e/linux-amd64",
          platform: process.env.POSIT_ENV_E2E_PLATFORM || "linux-amd64",
          server: envServer!,
        },
        clientVersion: "positenv-e2e",
        onProgress: (e) => {
          events.push(e);
          if (e.status === "log" && e.message) {
            console.log(`[${e.step}] ${e.message}`);
          }
        },
      });

      expect(result.contentId).toBeTruthy();
      expect(result.bundleId).toBeTruthy();
      console.log(`content ${result.contentId} bundle ${result.bundleId}`);
      console.log(`dashboard ${result.dashboardUrl}`);

      // Read files back out of the uploaded bundle. The endpoint wraps
      // each file as {path, size, content, binary, oversize}.
      const bundleFile = (name: string) =>
        fetch(
          `${connectUrl}/__api__/v1/content/${result.contentId}/bundles/${result.bundleId}/files/${name}`,
          { headers: { Authorization: `Key ${apiKey}` } },
        );
      const bundleFileJson = async <T>(name: string): Promise<T> => {
        const resp = await bundleFile(name);
        expect(resp.status).toBe(200);
        const wrapped = (await resp.json()) as { content: string };
        return JSON.parse(wrapped.content) as T;
      };

      // The marker rode along in the bundle.
      const marker = await bundleFileJson<{
        ref: string;
        digest: string;
        server: string;
      }>("posit-env.json");
      expect(marker.ref).toBe(ref);
      expect(marker.digest).toBe(digest);

      // The manifest switched Connect's environment management off.
      const manifest = await bundleFileJson<{
        environment?: { environment_management?: { python?: boolean } };
        python?: { package_manager?: { name?: string } };
      }>("manifest.json");
      expect(manifest.environment?.environment_management?.python).toBe(false);
      expect(manifest.python?.package_manager?.name).toBe("none");

      // No requirements.txt was needed or shipped.
      expect((await bundleFile("requirements.txt")).status).toBe(404);

      // Visiting the content starts it — through the posit-env
      // supervisor, on the environment's own interpreter.
      const contentUrl = `${connectUrl}/content/${result.contentId}/`;
      let page: Response | undefined;
      for (let i = 0; i < 30; i++) {
        page = await fetch(contentUrl, {
          headers: { Authorization: `Key ${apiKey}` },
        });
        if (page.status === 200) break;
        await new Promise((r) => setTimeout(r, 3000));
      }
      expect(page?.status).toBe(200);
      console.log(`content answered at ${contentUrl}`);

      // The launch reported a content-class observation to posit-env,
      // carrying the dashboard URL and the Connect host's system
      // package inventory.
      const envServerHost =
        process.env.POSIT_ENV_E2E_ENV_SERVER_HOST || "http://localhost:6464";
      const [ns = "", name = ""] = ref!.split("/");
      const envName = name.split(":")[0] ?? "";
      type Obs = {
        class: string;
        context?: string;
        meta?: {
          url?: string;
          packages?: { manager?: string; count?: number };
          os?: { id?: string };
        };
      };
      let observation: Obs | undefined;
      for (let i = 0; i < 20 && !observation; i++) {
        const resp = await fetch(
          `${envServerHost}/api/v1/environments/${ns}/${envName}/observations`,
        );
        if (resp.status === 200) {
          const body = (await resp.json()) as { observations?: Obs[] };
          observation = (body.observations ?? []).find(
            (o) =>
              o.class === "content" &&
              (o.context ?? "").includes(result.contentId),
          );
        }
        if (!observation) await new Promise((r) => setTimeout(r, 3000));
      }
      expect(observation).toBeDefined();
      expect(observation?.meta?.url).toContain(result.contentId);
      expect(observation?.meta?.packages?.count ?? 0).toBeGreaterThan(0);
      console.log(
        `observation: context=${observation?.context} url=${observation?.meta?.url} ` +
          `system packages=${observation?.meta?.packages?.count} (${observation?.meta?.packages?.manager})`,
      );

      // The publish record carries the environment identity.
      const record = await fs.readFile(
        path.join(
          projectDir,
          ".posit",
          "publish",
          "deployments",
          "positenv-e2e.toml",
        ),
        "utf-8",
      );
      expect(record).toContain("[posit_env]");
      expect(record).toContain(digest!);

      await fs.rm(projectDir, { recursive: true, force: true });
    },
  );

  test.skipIf(!rConfigured)(
    "publishes an R shiny app that runs on the posit-env environment",
    async () => {
      const projectDir = await fs.mkdtemp(
        path.join(os.tmpdir(), "positenv-e2e-r-"),
      );
      await fs.writeFile(
        path.join(projectDir, "app.R"),
        `library(shiny)
library(jsonlite)
ui <- fluidPage(h2("posit-env e2e (R)"), verbatimTextOutput("identity"))
server <- function(input, output, session) {
  output$identity <- renderText(
    toJSON(list(env = Sys.getenv("POSIT_ENV_NAME", "?")), auto_unbox = TRUE)
  )
}
shinyApp(ui, server)
`,
      );

      const config: ConfigurationDetails = {
        $schema:
          "https://cdn.posit.co/publisher/schemas/posit-publishing-schema-v3.json",
        productType: ProductType.CONNECT,
        type: ContentType.R_SHINY,
        entrypoint: "app.R",
        title: "posit-env e2e dashboard (R)",
        r: {
          version: rVersion!,
          packageFile: "",
          packageManager: "renv",
        },
        validate: true,
        files: ["/app.R"],
      };

      const api = new ConnectAPI({ url: connectUrl!, apiKey: apiKey! });
      const result = await connectPublish({
        api,
        projectDir,
        saveName: "positenv-e2e-r",
        config,
        configName: "positenv-e2e-r.toml",
        serverUrl: connectUrl!,
        serverType: ServerType.CONNECT,
        positEnv: {
          ref: rRef!,
          digest: rDigest!,
          envPath: "/posit/store/unused-in-e2e/linux-amd64",
          platform: process.env.POSIT_ENV_E2E_PLATFORM || "linux-amd64",
          server: envServer!,
        },
        clientVersion: "positenv-e2e",
        onProgress: (e) => {
          if (e.status === "log" && e.message) {
            console.log(`[${e.step}] ${e.message}`);
          }
        },
      });

      expect(result.contentId).toBeTruthy();
      console.log(`R content ${result.contentId} bundle ${result.bundleId}`);

      // No renv.lock and no manifest packages — env management is off.
      const manifestResp = await fetch(
        `${connectUrl}/__api__/v1/content/${result.contentId}/bundles/${result.bundleId}/files/manifest.json`,
        { headers: { Authorization: `Key ${apiKey}` } },
      );
      expect(manifestResp.status).toBe(200);
      const manifest = JSON.parse(
        ((await manifestResp.json()) as { content: string }).content,
      ) as {
        environment?: { environment_management?: { r?: boolean } };
        packages?: Record<string, unknown>;
      };
      expect(manifest.environment?.environment_management?.r).toBe(false);
      expect(Object.keys(manifest.packages ?? {})).toHaveLength(0);

      // The app starts on the environment's R.
      const contentUrl = `${connectUrl}/content/${result.contentId}/`;
      let page: Response | undefined;
      for (let i = 0; i < 40; i++) {
        page = await fetch(contentUrl, {
          headers: { Authorization: `Key ${apiKey}` },
        });
        if (page.status === 200) break;
        await new Promise((r) => setTimeout(r, 3000));
      }
      expect(page?.status).toBe(200);
      console.log(`R content answered at ${contentUrl}`);

      await fs.rm(projectDir, { recursive: true, force: true });
    },
  );
});
