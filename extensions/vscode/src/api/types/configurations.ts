// Copyright (C) 2023 by Posit Software, PBC.

import { AgentError } from "./error";
import { ConnectConfig } from "./connect";
import { SchemaURL } from "./schema";
import { InterpreterDefaults } from "./interpreters";
import { ProductType } from "./contentRecords";

export type ConfigurationLocation = {
  configurationName: string;
  configurationPath: string;
  configurationRelPath: string;
  projectDir: string;
};

export type ConfigurationError = {
  error: AgentError;
} & ConfigurationLocation;

export type Configuration = {
  configuration: ConfigurationDetails;
} & ConfigurationLocation;

export type ConfigurationInspectionResult = {
  configuration: ConfigurationDetails;
  projectDir: string;
};

export const areInspectionResultsSimilarEnough = (
  inspect1: ConfigurationInspectionResult,
  inspect2: ConfigurationInspectionResult,
) => {
  // Not comparing ALL attributes, just enough to maintain uniqueness and
  // confidence that this is a "similar" inspection result
  return (
    inspect1.projectDir === inspect2.projectDir &&
    inspect1.configuration.entrypoint === inspect2.configuration.entrypoint &&
    inspect1.configuration.type === inspect2.configuration.type
  );
};

export function isConfigurationError(
  cfg: Configuration | ConfigurationError,
): cfg is ConfigurationError {
  return (cfg as ConfigurationError).error !== undefined;
}

export enum ContentType {
  HTML = "html",
  JUPYTER_NOTEBOOK = "jupyter-notebook",
  JUPYTER_VOILA = "jupyter-voila",
  PYTHON_BOKEH = "python-bokeh",
  PYTHON_DASH = "python-dash",
  PYTHON_FASTAPI = "python-fastapi",
  PYTHON_FLASK = "python-flask",
  PYTHON_SHINY = "python-shiny",
  PYTHON_STREAMLIT = "python-streamlit",
  PYTHON_GRADIO = "python-gradio",
  PYTHON_PANEL = "python-panel",
  QUARTO_SHINY = "quarto-shiny",
  QUARTO = "quarto",
  QUARTO_STATIC = "quarto-static",
  R_PLUMBER = "r-plumber",
  R_SHINY = "r-shiny",
  RMD_SHINY = "rmd-shiny",
  RMD = "rmd",
  UNKNOWN = "unknown",
}

export const allValidContentTypes: ContentType[] = [
  ContentType.HTML,
  ContentType.JUPYTER_NOTEBOOK,
  ContentType.JUPYTER_VOILA,
  ContentType.PYTHON_BOKEH,
  ContentType.PYTHON_DASH,
  ContentType.PYTHON_FASTAPI,
  ContentType.PYTHON_FLASK,
  ContentType.PYTHON_SHINY,
  ContentType.PYTHON_STREAMLIT,
  ContentType.PYTHON_GRADIO,
  ContentType.PYTHON_PANEL,
  ContentType.QUARTO_SHINY,
  ContentType.QUARTO,
  ContentType.QUARTO_STATIC,
  ContentType.R_PLUMBER,
  ContentType.R_SHINY,
  ContentType.RMD_SHINY,
  ContentType.RMD,
];

export const contentTypeStrings = {
  [ContentType.HTML]: "serve pre-rendered HTML",
  [ContentType.JUPYTER_NOTEBOOK]: "render with Jupyter nbconvert",
  [ContentType.JUPYTER_VOILA]: "run with Jupyter Voila",
  [ContentType.PYTHON_BOKEH]: "run with Bokeh",
  [ContentType.PYTHON_DASH]: "run with Dash",
  [ContentType.PYTHON_FASTAPI]: "run with FastAPI",
  [ContentType.PYTHON_FLASK]: "run with Flask",
  [ContentType.PYTHON_SHINY]: "run with Shiny for Python",
  [ContentType.PYTHON_STREAMLIT]: "run with Streamlit",
  [ContentType.PYTHON_GRADIO]: "run with Gradio",
  [ContentType.PYTHON_PANEL]: "run with Panel",
  [ContentType.QUARTO_SHINY]: "render with Quarto and run embedded Shiny app",
  [ContentType.QUARTO]: "render with Quarto",
  [ContentType.QUARTO_STATIC]: "render with Quarto",
  [ContentType.R_PLUMBER]: "run with Plumber",
  [ContentType.R_SHINY]: "run with Shiny for R",
  [ContentType.RMD_SHINY]:
    "render with rmarkdown/knitr and run embedded Shiny app",
  [ContentType.RMD]: "render with rmarkdown/knitr",
  [ContentType.UNKNOWN]:
    "unknown content type; manual selection needed to deploy",
};

export type ConfigurationDetails = {
  $schema: SchemaURL;
  alternatives?: ConfigurationDetails[];
  productType: ProductType;
  type: ContentType;
  entrypoint?: string;
  source?: string;
  title?: string;
  description?: string;
  thumbnail?: string;
  tags?: string[];
  python?: PythonConfig;
  r?: RConfig;
  quarto?: QuartoConfig;
  environment?: EnvironmentConfig;
  validate: boolean;
  files?: string[];
  secrets?: string[];
  integrationRequests?: IntegrationRequest[];
  schedules?: ScheduleConfig[];
  access?: AccessConfig;
  connect?: ConnectConfig;
};

export type IntegrationRequest = {
  displayName?: string;
  displayDescription?: string;
  guid?: string;
  name?: string;
  description?: string;
  authType?: string;
  type?: string;
  config?: Record<string, string | undefined>;
};

export type PythonConfig = {
  version: string;
  packageFile: string;
  packageManager: string;
};

export type RConfig = {
  version: string;
  packageFile: string;
  packageManager: string;
};

export type QuartoConfig = {
  version: string;
  engines?: string[];
};

export type EnvironmentConfig = Record<string, string>;

export type ScheduleConfig = {
  start: string;
  recurrence: string;
};

export enum AccessType {
  ANONYMOUS = "all",
  LOGGED_IN = "logged-in",
  ACL = "acl",
}

export type AccessConfig = {
  type: AccessType;
  users?: User[];
  groups?: Group[];
};

export type User = {
  id?: string;
  guid?: string;
  name?: string;
  permissions: string;
};

export type Group = {
  id?: string;
  guid?: string;
  name?: string;
  permissions: string;
};

export function UpdateAllConfigsWithDefaults(
  configs: (Configuration | ConfigurationError)[],
  defaults: InterpreterDefaults,
) {
  for (let i = 0; i < configs.length; i++) {
    const config = configs[i];
    if (config !== undefined) {
      configs[i] = UpdateConfigWithDefaults(config, defaults);
    }
  }
  return configs;
}

export function UpdateConfigWithDefaults(
  config: Configuration | ConfigurationError,
  defaults: InterpreterDefaults,
) {
  if (isConfigurationError(config)) {
    return config;
  }

  // Fill in empty definitions with the current defaults
  // but only if the section is defined (which indicates the dependency)
  if (config.configuration.r !== undefined) {
    if (!config.configuration.r.version) {
      config.configuration.r.version = defaults.r.version;
    }
    if (!config.configuration.r.packageFile) {
      config.configuration.r.packageFile = defaults.r.packageFile;
    }
    if (!config.configuration.r.packageManager) {
      config.configuration.r.packageManager = defaults.r.packageManager;
    }
  }
  if (config.configuration.python !== undefined) {
    if (!config.configuration.python.version) {
      config.configuration.python.version = defaults.python.version;
    }
    if (!config.configuration.python.packageFile) {
      config.configuration.python.packageFile = defaults.python.packageFile;
    }
    if (!config.configuration.python.packageManager) {
      config.configuration.python.packageManager =
        defaults.python.packageManager;
    }
  }
  return config;
}
