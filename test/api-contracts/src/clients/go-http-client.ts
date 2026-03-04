import type { BackendClient, ContractResult, ResultStatus } from "../client";

function mapStatus(httpStatus: number): ResultStatus {
  switch (httpStatus) {
    case 200:
      return "ok";
    case 201:
      return "created";
    case 204:
      return "no_content";
    case 404:
      return "not_found";
    case 400:
      return "bad_request";
    case 409:
      return "conflict";
    default:
      throw new Error(`Unexpected HTTP status: ${httpStatus}`);
  }
}

async function toContractResult(res: Response): Promise<ContractResult> {
  const contentType = res.headers.get("content-type") ?? "";
  let body: unknown = null;

  if (res.status !== 204) {
    if (contentType.includes("application/json")) {
      body = await res.json();
    } else {
      // Some Go handlers call WriteHeader before setting Content-Type,
      // so the header may be missing. Try parsing as JSON anyway.
      const text = await res.text();
      if (text) {
        try {
          body = JSON.parse(text);
        } catch {
          // Not JSON — leave body as null
        }
      }
    }
  }

  return { status: mapStatus(res.status), body };
}

export class GoHttpClient implements BackendClient {
  constructor(private apiBase: string) {}

  // Configurations

  async getConfigurations(
    params?: { dir?: string },
  ): Promise<ContractResult> {
    const query = params?.dir ? `?dir=${params.dir}` : "";
    const res = await fetch(
      `${this.apiBase}/api/configurations${query}`,
    );
    return toContractResult(res);
  }

  async getConfiguration(name: string): Promise<ContractResult> {
    const res = await fetch(
      `${this.apiBase}/api/configurations/${name}`,
    );
    return toContractResult(res);
  }

  async putConfiguration(
    name: string,
    body: unknown,
  ): Promise<ContractResult> {
    const res = await fetch(
      `${this.apiBase}/api/configurations/${name}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    return toContractResult(res);
  }

  async deleteConfiguration(name: string): Promise<ContractResult> {
    const res = await fetch(
      `${this.apiBase}/api/configurations/${name}`,
      { method: "DELETE" },
    );
    return toContractResult(res);
  }

  // Credentials

  async getCredentials(): Promise<ContractResult> {
    const res = await fetch(`${this.apiBase}/api/credentials`);
    return toContractResult(res);
  }

  async postCredential(body: unknown): Promise<ContractResult> {
    const res = await fetch(`${this.apiBase}/api/credentials`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return toContractResult(res);
  }

  async deleteCredential(guid: string): Promise<ContractResult> {
    const res = await fetch(
      `${this.apiBase}/api/credentials/${guid}`,
      { method: "DELETE" },
    );
    return toContractResult(res);
  }

  async resetCredentials(): Promise<ContractResult> {
    const res = await fetch(`${this.apiBase}/api/credentials`, {
      method: "DELETE",
    });
    return toContractResult(res);
  }

  // Deployments

  async getDeployments(
    params?: { dir?: string },
  ): Promise<ContractResult> {
    const query = params?.dir ? `?dir=${params.dir}` : "";
    const res = await fetch(
      `${this.apiBase}/api/deployments${query}`,
    );
    return toContractResult(res);
  }

  async getDeployment(name: string): Promise<ContractResult> {
    const res = await fetch(
      `${this.apiBase}/api/deployments/${name}`,
    );
    return toContractResult(res);
  }

  async postDeployment(body: unknown): Promise<ContractResult> {
    const res = await fetch(`${this.apiBase}/api/deployments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return toContractResult(res);
  }

  async patchDeployment(
    name: string,
    body: unknown,
  ): Promise<ContractResult> {
    const res = await fetch(
      `${this.apiBase}/api/deployments/${name}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    return toContractResult(res);
  }

  async deleteDeployment(name: string): Promise<ContractResult> {
    const res = await fetch(
      `${this.apiBase}/api/deployments/${name}`,
      { method: "DELETE" },
    );
    return toContractResult(res);
  }

  // Inspection

  async postInspect(params: {
    dir?: string;
    entrypoint?: string;
    recursive?: string;
  }): Promise<ContractResult> {
    const qs = new URLSearchParams();
    if (params.dir) qs.set("dir", params.dir);
    if (params.entrypoint) qs.set("entrypoint", params.entrypoint);
    if (params.recursive) qs.set("recursive", params.recursive);
    const query = qs.toString() ? `?${qs.toString()}` : "";
    const res = await fetch(
      `${this.apiBase}/api/inspect${query}`,
      { method: "POST" },
    );
    return toContractResult(res);
  }

  // Entrypoints

  async postEntrypoints(
    params?: { dir?: string },
  ): Promise<ContractResult> {
    const query = params?.dir ? `?dir=${params.dir}` : "";
    const res = await fetch(
      `${this.apiBase}/api/entrypoints${query}`,
      { method: "POST" },
    );
    return toContractResult(res);
  }

  // Files

  async getFiles(
    params?: { pathname?: string },
  ): Promise<ContractResult> {
    const query = params?.pathname
      ? `?pathname=${encodeURIComponent(params.pathname)}`
      : "";
    const res = await fetch(
      `${this.apiBase}/api/files${query}`,
    );
    return toContractResult(res);
  }

  // Configuration sub-resources

  async getConfigFiles(
    configName: string,
    params?: { dir?: string },
  ): Promise<ContractResult> {
    const query = params?.dir ? `?dir=${params.dir}` : "";
    const res = await fetch(
      `${this.apiBase}/api/configurations/${configName}/files${query}`,
    );
    return toContractResult(res);
  }

  async postConfigFiles(
    configName: string,
    body: unknown,
  ): Promise<ContractResult> {
    const res = await fetch(
      `${this.apiBase}/api/configurations/${configName}/files`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    return toContractResult(res);
  }

  async getConfigSecrets(
    configName: string,
    params?: { dir?: string },
  ): Promise<ContractResult> {
    const query = params?.dir ? `?dir=${params.dir}` : "";
    const res = await fetch(
      `${this.apiBase}/api/configurations/${configName}/secrets${query}`,
    );
    return toContractResult(res);
  }

  async postConfigSecrets(
    configName: string,
    body: unknown,
  ): Promise<ContractResult> {
    const res = await fetch(
      `${this.apiBase}/api/configurations/${configName}/secrets`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    return toContractResult(res);
  }

  async getConfigPythonPackages(
    configName: string,
    params?: { dir?: string },
  ): Promise<ContractResult> {
    const query = params?.dir ? `?dir=${params.dir}` : "";
    const res = await fetch(
      `${this.apiBase}/api/configurations/${configName}/packages/python${query}`,
    );
    return toContractResult(res);
  }

  async getConfigRPackages(
    configName: string,
    params?: { dir?: string },
  ): Promise<ContractResult> {
    const query = params?.dir ? `?dir=${params.dir}` : "";
    const res = await fetch(
      `${this.apiBase}/api/configurations/${configName}/packages/r${query}`,
    );
    return toContractResult(res);
  }

  async getIntegrationRequests(
    configName: string,
    params?: { dir?: string },
  ): Promise<ContractResult> {
    const query = params?.dir ? `?dir=${params.dir}` : "";
    const res = await fetch(
      `${this.apiBase}/api/configurations/${configName}/integration-requests${query}`,
    );
    return toContractResult(res);
  }

  async postIntegrationRequest(
    configName: string,
    body: unknown,
  ): Promise<ContractResult> {
    const res = await fetch(
      `${this.apiBase}/api/configurations/${configName}/integration-requests`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    return toContractResult(res);
  }

  async deleteIntegrationRequest(
    configName: string,
    body: unknown,
  ): Promise<ContractResult> {
    const res = await fetch(
      `${this.apiBase}/api/configurations/${configName}/integration-requests`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    return toContractResult(res);
  }

  // Credentials (by GUID)

  async getCredential(guid: string): Promise<ContractResult> {
    const res = await fetch(
      `${this.apiBase}/api/credentials/${guid}`,
    );
    return toContractResult(res);
  }

  // Interpreters

  async getInterpreters(
    params?: { dir?: string },
  ): Promise<ContractResult> {
    const query = params?.dir ? `?dir=${params.dir}` : "";
    const res = await fetch(
      `${this.apiBase}/api/interpreters${query}`,
    );
    return toContractResult(res);
  }

  // Accounts

  async getAccounts(): Promise<ContractResult> {
    const res = await fetch(`${this.apiBase}/api/accounts`);
    return toContractResult(res);
  }

  async getAccount(name: string): Promise<ContractResult> {
    const res = await fetch(
      `${this.apiBase}/api/accounts/${name}`,
    );
    return toContractResult(res);
  }
}
