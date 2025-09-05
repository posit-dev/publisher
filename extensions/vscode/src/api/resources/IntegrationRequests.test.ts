import { describe, test, expect, vi, beforeEach } from "vitest";
import { AxiosInstance } from "axios";
import { IntegrationRequests } from "./IntegrationRequests";
import { IntegrationRequest } from "../types/configurations";

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockDelete = vi.fn();

const mockAxios = {
  get: mockGet,
  post: mockPost,
  delete: mockDelete,
};

describe("IntegrationRequests API client", () => {
  let api: IntegrationRequests;

  beforeEach(() => {
    vi.clearAllMocks();
    api = new IntegrationRequests(mockAxios as unknown as AxiosInstance);
  });

  test("list encodes configuration name and passes dir param", async () => {
    mockGet.mockResolvedValue({ data: [] });
    const configName = "my config"; // space to verify encoding
    const dir = "/project/path";
    await api.list(configName, dir);
    expect(mockGet).toHaveBeenCalledWith(
      "configurations/my%20config/integration-requests",
      { params: { dir } },
    );
  });

  test("add posts integration request with encoded config name and dir param", async () => {
    const request: IntegrationRequest = {
      name: "snowflake-prod",
      integrationType: "snowflake",
    } as IntegrationRequest;
    mockPost.mockResolvedValue({ data: request });
    const configName = "proj_alpha";
    const dir = "/workspace";
    await api.add(configName, dir, request);
    expect(mockPost).toHaveBeenCalledWith(
      "configurations/proj_alpha/integration-requests",
      request,
      { params: { dir } },
    );
  });

  test("delete sends request body in data field with encoded config name and dir param", async () => {
    const request: IntegrationRequest = {
      name: "aws s3",
      integrationType: "aws",
    } as IntegrationRequest;
    mockDelete.mockResolvedValue({ status: 204 });
    const configName = "cfg 1";
    const dir = ".";
    await api.delete(configName, dir, request);
    expect(mockDelete).toHaveBeenCalledWith(
      "configurations/cfg%201/integration-requests",
      { data: request, params: { dir } },
    );
  });
});
