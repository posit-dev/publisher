// Copyright (C) 2023 by Posit Software, PBC.

import { AgentError } from "./error";
import { ConnectConfig } from "./connect";
import { SchemaURL } from "./schema";

export type ConfigurationLocation = {
  configurationName: string;
  configurationPath: string;
};

export type ConfigurationError = {
  error: AgentError;
} & ConfigurationLocation;

export type Configuration = {
  configuration: ConfigurationDetails;
} & ConfigurationLocation;

export function isConfigurationError(
  c: Configuration | ConfigurationError,
): c is ConfigurationError {
  return (c as ConfigurationError).error !== undefined;
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
  QUARTO_SHINY = "quarto-shiny",
  QUARTO = "quarto",
  R_PLUMBER = "r-plumber",
  R_SHINY = "r-shiny",
  RMD_SHINY = "rmd-shiny",
  RMD = "rmd",
  UNKNOWN = "unknown",
}

export const contentTypeStrings = {
  [ContentType.HTML]: "serve pre-rendered HTML",
  [ContentType.JUPYTER_NOTEBOOK]: "render with Jupyter nbconvert",
  [ContentType.JUPYTER_VOILA]: "run with Jupyter Voila",
  [ContentType.PYTHON_BOKEH]: "run with Bokeh",
  [ContentType.PYTHON_DASH]: "run with Dash",
  [ContentType.PYTHON_FASTAPI]: "run with FastAPI",
  [ContentType.PYTHON_FLASK]: "run with Flask",
  [ContentType.PYTHON_SHINY]: "run with Python Shiny",
  [ContentType.PYTHON_STREAMLIT]: "run with Streamlit",
  [ContentType.QUARTO_SHINY]: "render with Quarto and run embedded Shiny app",
  [ContentType.QUARTO]: "render with Quarto",
  [ContentType.R_PLUMBER]: "run with Plumber",
  [ContentType.R_SHINY]: "run with R Shiny",
  [ContentType.RMD_SHINY]:
    "render with rmarkdown/knitr and run embedded Shiny app",
  [ContentType.RMD]: "render with rmarkdown/knitr",
  [ContentType.UNKNOWN]: "unknown content type; cannot deploy this item",
};

export type ConfigurationDetails = {
  $schema: SchemaURL;
  type: ContentType;
  entrypoint?: string;
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
  schedules?: ScheduleConfig[];
  access?: AccessConfig;
  connect?: ConnectConfig;
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
