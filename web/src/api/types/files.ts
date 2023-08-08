export enum DeploymentFileType {
    REGULAR = 'REGULAR',
    DIRECTORY = 'DIR',
}

export type DeploymentFile = {
    file_type: DeploymentFileType
    pathname: string
    base_name: string
    size: number
    modified_datetime: string
    is_dir: boolean
    is_entrypoint: boolean
    is_file: boolean
    is_excluded: boolean
    files: DeploymentFile[]
}
