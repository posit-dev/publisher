// Copyright (C) 2023 by Posit Software, PBC.

import { ConnectConfig } from 'src/api/types/connect';
import { SchemaURL } from 'src/api/types/schema';

export type ConfigurationLocation = {
  configurationName: string;
  configurationPath: string;
}

export type ConfigurationError = {
  error: string;
} & ConfigurationLocation

export type Configuration = {
  configuration: ConfigurationDetails
} & ConfigurationLocation

export function isConfigurationError(
  c: Configuration | ConfigurationError
): c is ConfigurationError {
  return (c as ConfigurationError).error !== undefined;
}

enum AppMode {
  UNKNOWN = '',
  SHINY = 'shiny',
  RMD_SHINY = 'rmd-shiny',
  RMD_STATIC = 'rmd-static',
  STATIC = 'static',
  PLUMBER_API = 'api',
  JUPYTER_STATIC = 'jupyter-static',
  JUPYTER_VOILA = 'jupyter-voila',
  PYTHON_API = 'python-api',
  PYTHON_DASH = 'python-dash',
  PYTHON_STREAMLIT = 'python-streamlit',
  PYTHON_BOKEH = 'python-bokeh',
  PYTHON_FASTAPI = 'python-fastapi',
  PYTHON_SHINY = 'python-shiny',
  QUARTO_SHINY = 'quarto-shiny',
  QUARTO_STATIC = 'quarto-static',
}

export type ConfigurationDetails = {
  $schema: SchemaURL,
  type: AppMode,
  entrypoint?: string,
  title?: string,
  description?: string,
  thumbnail?: string,
  tags?: string[],
  python?: PythonConfig,
  r?: RConfig,
  quarto?: QuartoConfig,
  environment?: EnvironmentConfig,
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
  engines: string[]
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
