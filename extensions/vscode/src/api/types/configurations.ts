// Copyright (C) 2023 by Posit Software, PBC.

import { AgentError } from './error';
import { ConnectConfig } from './connect';
import { SchemaURL } from './schema';

export type ConfigurationLocation = {
  configurationName: string;
  configurationPath: string;
}

export type ConfigurationError = {
  error: AgentError;
} & ConfigurationLocation

export type Configuration = {
  configuration: ConfigurationDetails
} & ConfigurationLocation

export function isConfigurationError(
  c: Configuration | ConfigurationError
): c is ConfigurationError {
  return (c as ConfigurationError).error !== undefined;
}

export enum ContentType {
  HTML = 'html',
  JUPYTER_NOTEBOOK = 'jupyter-notebook',
  JUPYTER_VOILA = 'jupyter-voila',
  PYTHON_BOKEH = 'python-bokeh',
  PYTHON_DASH = 'python-dash',
  PYTHON_FASTAPI = 'python-fastapi',
  PYTHON_FLASK = 'python-flask',
  PYTHON_SHINY = 'python-shiny',
  PYTHON_STREAMLIT = 'python-streamlit',
  QUARTO_SHINY = 'quarto-shiny',
  QUARTO = 'quarto',
  R_PLUMBER = 'r-plumber',
  R_SHINY = 'r-shiny',
  RMD_SHINY = 'rmd-shiny',
  RMD = 'rmd',
  UNKNOWN = 'unknown'
}

export type ConfigurationDetails = {
  $schema: SchemaURL,
  type: ContentType,
  entrypoint?: string,
  title?: string,
  description?: string,
  thumbnail?: string,
  tags?: string[],
  python?: PythonConfig,
  r?: RConfig,
  quarto?: QuartoConfig,
  environment?: EnvironmentConfig,
  validate: boolean,
  secrets?: string[],
  schedules?: ScheduleConfig[],
  access?: AccessConfig,
  connect?: ConnectConfig,
}

export type PythonConfig = {
  version: string,
  packageFile: string,
  packageManager: string
}

export type RConfig = {
  version: string,
  packageFile: string,
  packageManager: string
}

export type QuartoConfig = {
  version: string,
  engines?: string[]
}

export type EnvironmentConfig = Record<string, string>

export type ScheduleConfig = {
  start: string,
  recurrence: string
}

export enum AccessType {
  ANONYMOUS = 'all',
  LOGGED_IN = 'logged-in',
  ACL = 'acl'
}

export type AccessConfig = {
  type: AccessType,
  users?: User[],
  groups?: Group[]
}

export type User = {
  id?: string,
  guid?: string,
  name?: string,
  permissions: string
}

export type Group = {
  id?: string,
  guid?: string,
  name?: string,
  permissions: string
}
