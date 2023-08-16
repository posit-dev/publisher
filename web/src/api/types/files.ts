// Copyright (C) 2023 by Posit Software, PBC.

export enum DeploymentFileType {
    REGULAR = 'REGULAR',
    DIRECTORY = 'DIR',
}

export enum ExclusionMatchSource {
    FILE = 'file',
    BUILT_IN = 'built-in',
    USER = 'user',
}

export type ExclusionMatch = {
    source: ExclusionMatchSource
    pattern: string
    file_path: string
    line: number
}

export type FileInfo = {
  size: number
  is_entrypoint: boolean
  exclusion: ExclusionMatch | null
}

export type DeploymentFile = FileInfo & {
    file_type: DeploymentFileType
    pathname: string
    base_name: string
    modified_datetime: string
    is_dir: boolean
    is_file: boolean
    files: DeploymentFile[]
}
