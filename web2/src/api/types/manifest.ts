// Copyright (C) 2023 by Posit Software, PBC.

import { AppMode } from 'src/api/types/apptypes';

export type ManifestMetadata = {
    appmode: AppMode;
    contentCategory?: string;
    entrypoint?: string;
    primaryRmd?: string;
    primaryHtml: string;
    hasParamters?: boolean;
}

export type PythonPackageManager = {
    name: string;
    version?: string;
    packageFile: string;
}

export type PythonManifest = {
    version: string;
    packageManager: PythonPackageManager;
}

export type JupyterManifest = {
    hideAllInput: boolean;
    hideTaggedInput: boolean;
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
