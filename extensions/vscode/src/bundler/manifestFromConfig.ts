// Copyright (C) 2026 by Posit Software, PBC.

import { ConfigurationDetails, ContentType } from "../api/types/configurations";
import { appModeFromType } from "./appMode";
import {
  Manifest,
  ManifestEnvironment,
  ManifestPythonPackageManager,
} from "./types";

// Builds a Connect manifest from a deployment configuration.
// Pure data transformation — no I/O or side effects.
export function manifestFromConfig(cfg: ConfigurationDetails): Manifest {
  const appmode = appModeFromType(cfg.type);

  const environment = buildEnvironment(
    cfg.r?.requiresR,
    cfg.python?.requiresPython,
  );

  return {
    version: 1,
    ...(cfg.r && { platform: cfg.r.version }),
    metadata: {
      appmode,
      entrypoint: cfg.entrypoint,
      ...primaryField(cfg.type, cfg.entrypoint),
      ...contentCategoryField(cfg),
      // false is omitted so it doesn't appear in manifest.json
      has_parameters: cfg.hasParameters || undefined,
    },
    ...(cfg.python && {
      python: {
        version: cfg.python.version,
        package_manager: buildPackageManager(cfg.python),
      },
    }),
    ...(cfg.jupyter && {
      jupyter: {
        hide_all_input: cfg.jupyter.hideAllInput ?? false,
        hide_tagged_input: cfg.jupyter.hideTaggedInput ?? false,
      },
    }),
    ...(cfg.quarto && {
      quarto: {
        version: cfg.quarto.version,
        engines: cfg.quarto.engines ?? [],
      },
    }),
    ...(environment && { environment }),
    packages: {},
    files: {},
    ...(cfg.integrationRequests && {
      integration_requests: cfg.integrationRequests.map((r) => ({
        guid: r.guid,
        name: r.name,
        description: r.description,
        auth_type: r.authType,
        type: r.type,
        config: r.config,
      })),
    }),
  };
}

const packageManagerMap: Record<string, { name: string; allow_uv?: boolean }> =
  {
    pip: { name: "pip", allow_uv: false },
    uv: { name: "uv", allow_uv: true },
    none: { name: "none" },
  };

function buildPackageManager(
  python: NonNullable<ConfigurationDetails["python"]>,
): ManifestPythonPackageManager | null {
  if (!python.packageManager) {
    return null;
  }

  const mapped = packageManagerMap[python.packageManager] ?? {
    name: "pip", // "auto" and any other value default to pip, server decides uv
  };

  return {
    ...mapped,
    package_file: python.packageFile,
  };
}

function buildEnvironment(
  requiresR?: string,
  requiresPython?: string,
): ManifestEnvironment | undefined {
  if (!requiresR && !requiresPython) {
    return undefined;
  }
  return {
    image: "",
    prebuilt: false,
    ...(requiresR && { r: { requires: requiresR } }),
    ...(requiresPython && { python: { requires: requiresPython } }),
  };
}

function primaryField(
  type: ContentType,
  entrypoint?: string,
): { primary_rmd?: string } | { primary_html?: string } | undefined {
  switch (type) {
    case ContentType.RMD:
    case ContentType.RMD_SHINY:
      return { primary_rmd: entrypoint };
    case ContentType.HTML:
      return { primary_html: entrypoint };
    default:
      return undefined;
  }
}

// Known Quarto output directories that indicate a pre-rendered multi-page site.
const quartoSiteOutputDirs = new Set(["_site", "_book"]);

// Detect multi-page site content for the manifest's content_category field.
// When an HTML deployment's entrypoint lives inside a known Quarto output
// directory (e.g. "_site/index.html" or "_book/index.html"), the content is a
// pre-rendered multi-page site. Connect uses content_category="site" to serve
// all files in the bundle rather than only the entrypoint.
//
// Only known Quarto output directories trigger this — an arbitrary subdirectory
// (e.g. "subdir/page.html") does not, to avoid false positives for standalone
// HTML files that happen to be nested.
function contentCategoryField(
  cfg: ConfigurationDetails,
): { content_category: string } | undefined {
  if (cfg.type === ContentType.HTML && cfg.entrypoint) {
    const parts = cfg.entrypoint.split("/");
    if (parts.length > 1 && quartoSiteOutputDirs.has(parts[0]!)) {
      return { content_category: "site" };
    }
  }
  return undefined;
}
