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
    filePath: string
    line: number
}

export type DeploymentFile = {
    fileType: DeploymentFileType
    pathname: string
    baseName: string
    size: number
    modifiedDatetime: string
    isDir: boolean
    isEntrypoint: boolean
    isFile: boolean
    files: DeploymentFile[]
    exclusion: ExclusionMatch | null
}
