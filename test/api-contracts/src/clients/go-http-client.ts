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
    case 409:
      return "conflict";
    default:
      throw new Error(`Unexpected HTTP status: ${httpStatus}`);
  }
}

async function toContractResult(res: Response): Promise<ContractResult> {
  const contentType = res.headers.get("content-type") ?? "";
  let body: unknown = null;

  if (res.status !== 204 && contentType.includes("application/json")) {
    body = await res.json();
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
}
