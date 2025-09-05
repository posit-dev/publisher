import { describe, test, expect, vi, beforeEach } from "vitest";
import { AxiosInstance } from "axios";
import { ConnectServer } from "./ConnectServer";

const mockGet = vi.fn();
const mockAxios = {
  get: mockGet,
};

describe("ConnectServer API client", () => {
  let api: ConnectServer;

  beforeEach(() => {
    vi.clearAllMocks();
    api = new ConnectServer(mockAxios as unknown as AxiosInstance);
  });

  test("getIntegrations calls correct endpoint", async () => {
    mockGet.mockResolvedValue({ data: [] });
    const accountName = "acct_demo";
    await api.getIntegrations(accountName);
    expect(mockGet).toHaveBeenCalledWith("accounts/acct_demo/integrations");
  });

  test("getServerSettings calls correct endpoint", async () => {
    mockGet.mockResolvedValue({ data: { license: {} } });
    const accountName = "acct_demo";
    await api.getServerSettings(accountName);
    expect(mockGet).toHaveBeenCalledWith("accounts/acct_demo/server-settings");
  });
});
