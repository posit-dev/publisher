export type ConnectContent = {
    name: string;
    title?: string;
    description?: string;
    access_type?: string;
    connection_timeout: number | null;
    read_timeout: number | null;
    init_timeout: number | null;
    idle_timeout: number | null;
    max_processes: number | null;
    min_processes: number | null;
    max_conns_per_process: number | null;
    load_factor: number | null;
    run_as?: string;
    run_as_current_user: boolean | null;
    memory_request: number | null;
    memory_limit: number | null;
    cpu_request: number | null;
    cpu_limit: number | null;
    service_account_name?: string;
    default_image_Name?: string;
}

export type ConnectEnvironmentVariable = {
    name: string;
    value: string | null;
    from_environment: boolean;
}

export type ConnectDeployment = {
    connect: ConnectContent;
    environment: ConnectEnvironmentVariable[];
}
