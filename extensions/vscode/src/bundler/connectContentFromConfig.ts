// Copyright (C) 2026 by Posit Software, PBC.

import { ConnectContent } from "@posit-dev/connect-api";
import { ConfigurationDetails } from "../api/types/configurations";

// Builds a ConnectContent PATCH body from a deployment configuration.
// Pure data transformation — no I/O or side effects.
// Port of Go's ConnectContentFromConfig (internal/clients/connect/content.go).
export function connectContentFromConfig(
  cfg: ConfigurationDetails,
): ConnectContent {
  const rt = cfg.connect?.runtime;
  const access = cfg.connect?.access;
  const k8s = cfg.connect?.kubernetes;

  return {
    name: "",
    title: cfg.title || undefined,
    description: cfg.description || undefined,

    // Runtime
    connection_timeout: rt?.connectionTimeout,
    read_timeout: rt?.readTimeout,
    init_timeout: rt?.initTimeout,
    idle_timeout: rt?.idleTimeout,
    max_processes: rt?.maxProcesses,
    min_processes: rt?.minProcesses,
    max_conns_per_process: rt?.maxConnsPerProcess,
    load_factor: rt?.loadFactor,

    // Access
    run_as: access?.runAs || undefined,
    run_as_current_user: access?.runAsCurrentUser,

    // Kubernetes
    memory_request: k8s?.memoryRequest,
    memory_limit: k8s?.memoryLimit,
    cpu_request: k8s?.cpuRequest,
    cpu_limit: k8s?.cpuLimit,
    amd_gpu_limit: k8s?.amdGpuLimit,
    nvidia_gpu_limit: k8s?.nvidiaGpuLimit,
    service_account_name: k8s?.serviceAccountName || undefined,
    default_image_name: k8s?.defaultImageName || undefined,
    default_r_environment_management: k8s?.defaultREnvironmentManagement,
    default_py_environment_management: k8s?.defaultPyEnvironmentManagement,
  };
}
