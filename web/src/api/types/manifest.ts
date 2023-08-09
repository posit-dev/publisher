// Copyright (C) 2023 by Posit Software, PBC.

import { AppMode } from 'src/api/types/apptypes';

export type ManifestMetadata = {
    appmode: AppMode;
    content_category?: string;
    entrypoint?: string;
    primary_rmd?: string;
    primary_html: string;
    has_paramters?: boolean;
}

export type PythonPackageManager = {
    name: string;
    version?: string;
    package_file: string;
}

export type PythonManifest = {
    version: string;
    package_manager: PythonPackageManager;
}

export type JupyterManifest = {
    hide_all_input: boolean;
    hide_tagged_input: boolean;
}

export type QuartoManifest = {
    version: string;
    engines: string[];
}

export type EnvironmentManifest = {
    image: string;
    prebuilt: boolean;
}

export type Package = {
    source: string;
    repository: string;
    description: Record<string, string>;
}

export type ManifestFile = {
    checksum: string;
}

export type Manifest = {
    version: number;
    locale: string
    platform?: string;
    metadata: ManifestMetadata;
    python?: PythonManifest;
    jupyter?: JupyterManifest;
    quarto?: QuartoManifest;
    environment?: EnvironmentManifest;
    packages: Record<string, Package>;
    files: Record<string, ManifestFile>;
}
