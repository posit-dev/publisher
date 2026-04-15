// Copyright (C) 2026 by Posit Software, PBC.

import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../logging", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  CloudEnvironment,
  ConnectCloudAPI,
  ContentAccess,
  ContentType as CloudContentType,
  ContentID,
  ContentResponse,
  Account,
} from "@posit-dev/connect-cloud-api";
import { ContentType } from "../api/types/configurations";
import type {
  ConfigurationDetails,
  ConnectCloudAccessControl,
} from "../api/types/configurations";
import { ProductType } from "../api/types/contentRecords";
import {
  cloudContentTypeFromPublisherType,
  getCloudContentInfo,
  getAccess,
  buildCreateContentRequest,
  buildUpdateContentRequest,
  CloudCredentialInfo,
} from "./cloudContentRequest";

describe("cloudContentTypeFromPublisherType", () => {
  it("maps jupyter-notebook to jupyter", () => {
    expect(
      cloudContentTypeFromPublisherType(ContentType.JUPYTER_NOTEBOOK),
    ).toBe(CloudContentType.Jupyter);
  });

  it("maps python-bokeh to bokeh", () => {
    expect(cloudContentTypeFromPublisherType(ContentType.PYTHON_BOKEH)).toBe(
      CloudContentType.Bokeh,
    );
  });

  it("maps python-dash to dash", () => {
    expect(cloudContentTypeFromPublisherType(ContentType.PYTHON_DASH)).toBe(
      CloudContentType.Dash,
    );
  });

  it("maps python-shiny to shiny", () => {
    expect(cloudContentTypeFromPublisherType(ContentType.PYTHON_SHINY)).toBe(
      CloudContentType.Shiny,
    );
  });

  it("maps r-shiny to shiny", () => {
    expect(cloudContentTypeFromPublisherType(ContentType.R_SHINY)).toBe(
      CloudContentType.Shiny,
    );
  });

  it("maps python-streamlit to streamlit", () => {
    expect(
      cloudContentTypeFromPublisherType(ContentType.PYTHON_STREAMLIT),
    ).toBe(CloudContentType.Streamlit);
  });

  it("maps quarto to quarto", () => {
    expect(cloudContentTypeFromPublisherType(ContentType.QUARTO)).toBe(
      CloudContentType.Quarto,
    );
  });

  it("maps quarto-shiny to quarto", () => {
    expect(cloudContentTypeFromPublisherType(ContentType.QUARTO_SHINY)).toBe(
      CloudContentType.Quarto,
    );
  });

  it("maps quarto-static to quarto", () => {
    expect(cloudContentTypeFromPublisherType(ContentType.QUARTO_STATIC)).toBe(
      CloudContentType.Quarto,
    );
  });

  it("maps rmd to rmarkdown", () => {
    expect(cloudContentTypeFromPublisherType(ContentType.RMD)).toBe(
      CloudContentType.RMarkdown,
    );
  });

  it("maps rmd-shiny to rmarkdown", () => {
    expect(cloudContentTypeFromPublisherType(ContentType.RMD_SHINY)).toBe(
      CloudContentType.RMarkdown,
    );
  });

  it("maps html to static", () => {
    expect(cloudContentTypeFromPublisherType(ContentType.HTML)).toBe(
      CloudContentType.Static,
    );
  });

  it("throws for unsupported content type", () => {
    expect(() =>
      cloudContentTypeFromPublisherType(ContentType.PYTHON_FASTAPI),
    ).toThrow(
      "content type 'python-fastapi' is not supported by Connect Cloud",
    );
  });
});

describe("getCloudContentInfo", () => {
  const contentId = ContentID("test-content-id");

  it("returns correct URLs for development environment", () => {
    const credential: CloudCredentialInfo = {
      accountId: "acc123",
      accountName: "test-account",
      environment: CloudEnvironment.Development,
    };

    const info = getCloudContentInfo(credential, contentId);

    expect(info.dashboardURL).toBe(
      "https://dev.connect.posit.cloud/test-account/content/test-content-id",
    );
    expect(info.directURL).toBe(
      "https://test-content-id.share.dev.connect.posit.cloud",
    );
    expect(info.logsURL).toBe(
      "https://dev.connect.posit.cloud/test-account/content/test-content-id/history",
    );
  });

  it("returns correct URLs for staging environment", () => {
    const credential: CloudCredentialInfo = {
      accountId: "acc123",
      accountName: "test-account",
      environment: CloudEnvironment.Staging,
    };

    const info = getCloudContentInfo(credential, contentId);

    expect(info.dashboardURL).toBe(
      "https://staging.connect.posit.cloud/test-account/content/test-content-id",
    );
    expect(info.directURL).toBe(
      "https://test-content-id.share.staging.connect.posit.cloud",
    );
    expect(info.logsURL).toBe(
      "https://staging.connect.posit.cloud/test-account/content/test-content-id/history",
    );
  });

  it("returns correct URLs for production environment", () => {
    const credential: CloudCredentialInfo = {
      accountId: "acc123",
      accountName: "test-account",
      environment: CloudEnvironment.Production,
    };

    const info = getCloudContentInfo(credential, contentId);

    expect(info.dashboardURL).toBe(
      "https://connect.posit.cloud/test-account/content/test-content-id",
    );
    expect(info.directURL).toBe(
      "https://test-content-id.share.connect.posit.cloud",
    );
    expect(info.logsURL).toBe(
      "https://connect.posit.cloud/test-account/content/test-content-id/history",
    );
  });
});

describe("getAccess", () => {
  let mockApi: ConnectCloudAPI;
  const accountId = "test-account-id";
  const contentId = ContentID("test-content-id");

  beforeEach(() => {
    mockApi = {
      getAccount: vi.fn(),
      getContent: vi.fn(),
    } as unknown as ConnectCloudAPI;
  });

  describe("first deploy", () => {
    it("defaults to public when no config and no private entitlement", async () => {
      vi.mocked(mockApi.getAccount).mockResolvedValue({
        id: accountId,
        name: "test",
        display_name: "Test",
        permissions: [],
        license: {
          entitlements: {
            account_private_content_flag: { enabled: false },
          },
        },
      } as Account);

      const access = await getAccess(
        mockApi,
        true,
        accountId,
        undefined,
        undefined,
      );

      expect(access).toBe(ContentAccess.ViewPublicEditPrivate);
      expect(mockApi.getAccount).toHaveBeenCalledWith(accountId);
    });

    it("defaults to private when no config and has private entitlement", async () => {
      vi.mocked(mockApi.getAccount).mockResolvedValue({
        id: accountId,
        name: "test",
        display_name: "Test",
        permissions: [],
        license: {
          entitlements: {
            account_private_content_flag: { enabled: true },
          },
        },
      } as Account);

      const access = await getAccess(
        mockApi,
        true,
        accountId,
        undefined,
        undefined,
      );

      expect(access).toBe(ContentAccess.ViewPrivateEditPrivate);
      expect(mockApi.getAccount).toHaveBeenCalledWith(accountId);
    });

    it("uses explicit publicAccess=true with no orgAccess", async () => {
      const accessControl: ConnectCloudAccessControl = {
        publicAccess: true,
      };

      const access = await getAccess(
        mockApi,
        true,
        accountId,
        undefined,
        accessControl,
      );

      expect(access).toBe(ContentAccess.ViewPublicEditPrivate);
      expect(mockApi.getAccount).not.toHaveBeenCalled();
    });

    it("uses explicit publicAccess=false with no orgAccess", async () => {
      const accessControl: ConnectCloudAccessControl = {
        publicAccess: false,
      };

      const access = await getAccess(
        mockApi,
        true,
        accountId,
        undefined,
        accessControl,
      );

      expect(access).toBe(ContentAccess.ViewPrivateEditPrivate);
      expect(mockApi.getAccount).not.toHaveBeenCalled();
    });

    it("maps publicAccess=true and orgAccess=disabled", async () => {
      const accessControl: ConnectCloudAccessControl = {
        publicAccess: true,
        organizationAccess: "disabled",
      };

      const access = await getAccess(
        mockApi,
        true,
        accountId,
        undefined,
        accessControl,
      );

      expect(access).toBe(ContentAccess.ViewPublicEditPrivate);
    });

    it("maps publicAccess=false and orgAccess=disabled", async () => {
      const accessControl: ConnectCloudAccessControl = {
        publicAccess: false,
        organizationAccess: "disabled",
      };

      const access = await getAccess(
        mockApi,
        true,
        accountId,
        undefined,
        accessControl,
      );

      expect(access).toBe(ContentAccess.ViewPrivateEditPrivate);
    });

    it("maps publicAccess=true and orgAccess=viewer", async () => {
      const accessControl: ConnectCloudAccessControl = {
        publicAccess: true,
        organizationAccess: "viewer",
      };

      const access = await getAccess(
        mockApi,
        true,
        accountId,
        undefined,
        accessControl,
      );

      expect(access).toBe(ContentAccess.ViewPublicEditPrivate);
    });

    it("maps publicAccess=true and orgAccess=editor", async () => {
      const accessControl: ConnectCloudAccessControl = {
        publicAccess: true,
        organizationAccess: "editor",
      };

      const access = await getAccess(
        mockApi,
        true,
        accountId,
        undefined,
        accessControl,
      );

      expect(access).toBe(ContentAccess.ViewPublicEditTeam);
    });

    it("maps publicAccess=false and orgAccess=viewer", async () => {
      const accessControl: ConnectCloudAccessControl = {
        publicAccess: false,
        organizationAccess: "viewer",
      };

      const access = await getAccess(
        mockApi,
        true,
        accountId,
        undefined,
        accessControl,
      );

      expect(access).toBe(ContentAccess.ViewTeamEditPrivate);
    });

    it("maps publicAccess=false and orgAccess=editor", async () => {
      const accessControl: ConnectCloudAccessControl = {
        publicAccess: false,
        organizationAccess: "editor",
      };

      const access = await getAccess(
        mockApi,
        true,
        accountId,
        undefined,
        accessControl,
      );

      expect(access).toBe(ContentAccess.ViewTeamEditTeam);
    });
  });

  describe("redeploy", () => {
    it("rejects when contentId is missing", async () => {
      await expect(
        getAccess(mockApi, false, accountId, undefined, undefined),
      ).rejects.toThrow("contentId required for redeploy");
    });

    it("returns undefined when no accessControl", async () => {
      const access = await getAccess(
        mockApi,
        false,
        accountId,
        contentId,
        undefined,
      );

      expect(access).toBeUndefined();
      expect(mockApi.getContent).not.toHaveBeenCalled();
    });

    it("returns undefined when accessControl has no fields set", async () => {
      const accessControl: ConnectCloudAccessControl = {};

      const access = await getAccess(
        mockApi,
        false,
        accountId,
        contentId,
        accessControl,
      );

      expect(access).toBeUndefined();
      expect(mockApi.getContent).not.toHaveBeenCalled();
    });

    it("uses both — public=false, org=disabled", async () => {
      const access = await getAccess(mockApi, false, accountId, contentId, {
        publicAccess: false,
        organizationAccess: "disabled",
      });
      expect(access).toBe(ContentAccess.ViewPrivateEditPrivate);
      expect(mockApi.getContent).not.toHaveBeenCalled();
    });

    it("uses both — public=false, org=viewer", async () => {
      const access = await getAccess(mockApi, false, accountId, contentId, {
        publicAccess: false,
        organizationAccess: "viewer",
      });
      expect(access).toBe(ContentAccess.ViewTeamEditPrivate);
      expect(mockApi.getContent).not.toHaveBeenCalled();
    });

    it("uses both — public=false, org=editor", async () => {
      const access = await getAccess(mockApi, false, accountId, contentId, {
        publicAccess: false,
        organizationAccess: "editor",
      });
      expect(access).toBe(ContentAccess.ViewTeamEditTeam);
      expect(mockApi.getContent).not.toHaveBeenCalled();
    });

    it("uses both — public=true, org=disabled", async () => {
      const access = await getAccess(mockApi, false, accountId, contentId, {
        publicAccess: true,
        organizationAccess: "disabled",
      });
      expect(access).toBe(ContentAccess.ViewPublicEditPrivate);
      expect(mockApi.getContent).not.toHaveBeenCalled();
    });

    it("uses both — public=true, org=viewer", async () => {
      const access = await getAccess(mockApi, false, accountId, contentId, {
        publicAccess: true,
        organizationAccess: "viewer",
      });
      expect(access).toBe(ContentAccess.ViewPublicEditPrivate);
      expect(mockApi.getContent).not.toHaveBeenCalled();
    });

    it("uses both — public=true, org=editor", async () => {
      const access = await getAccess(mockApi, false, accountId, contentId, {
        publicAccess: true,
        organizationAccess: "editor",
      });
      expect(access).toBe(ContentAccess.ViewPublicEditTeam);
      expect(mockApi.getContent).not.toHaveBeenCalled();
    });

    it("merges publicAccess=true with server orgAccess=viewer", async () => {
      vi.mocked(mockApi.getContent).mockResolvedValue({
        id: contentId,
        access: ContentAccess.ViewTeamEditPrivate,
      } as ContentResponse);

      const accessControl: ConnectCloudAccessControl = {
        publicAccess: true,
      };

      const access = await getAccess(
        mockApi,
        false,
        accountId,
        contentId,
        accessControl,
      );

      expect(access).toBe(ContentAccess.ViewPublicEditPrivate);
      expect(mockApi.getContent).toHaveBeenCalledWith(contentId);
    });

    it("merges publicAccess=false with server ViewPublicEditTeam (orgAccess=viewer)", async () => {
      vi.mocked(mockApi.getContent).mockResolvedValue({
        id: contentId,
        access: ContentAccess.ViewPublicEditTeam,
      } as ContentResponse);

      const accessControl: ConnectCloudAccessControl = {
        publicAccess: false,
      };

      const access = await getAccess(
        mockApi,
        false,
        accountId,
        contentId,
        accessControl,
      );

      // ViewPublicEditTeam derives orgAccess=viewer (matching Go behavior)
      expect(access).toBe(ContentAccess.ViewTeamEditPrivate);
      expect(mockApi.getContent).toHaveBeenCalledWith(contentId);
    });

    it("merges publicAccess=true with server ViewPublicEditTeam (orgAccess=viewer)", async () => {
      vi.mocked(mockApi.getContent).mockResolvedValue({
        id: contentId,
        access: ContentAccess.ViewPublicEditTeam,
      } as ContentResponse);

      const accessControl: ConnectCloudAccessControl = {
        publicAccess: true,
      };

      const access = await getAccess(
        mockApi,
        false,
        accountId,
        contentId,
        accessControl,
      );

      // Public access preserved, orgAccess=viewer from ViewPublicEditTeam
      expect(access).toBe(ContentAccess.ViewPublicEditPrivate);
      expect(mockApi.getContent).toHaveBeenCalledWith(contentId);
    });

    it("merges orgAccess=viewer with server publicAccess=false", async () => {
      vi.mocked(mockApi.getContent).mockResolvedValue({
        id: contentId,
        access: ContentAccess.ViewPrivateEditPrivate,
      } as ContentResponse);

      const accessControl: ConnectCloudAccessControl = {
        organizationAccess: "viewer",
      };

      const access = await getAccess(
        mockApi,
        false,
        accountId,
        contentId,
        accessControl,
      );

      expect(access).toBe(ContentAccess.ViewTeamEditPrivate);
      expect(mockApi.getContent).toHaveBeenCalledWith(contentId);
    });

    it("merges orgAccess=editor with server publicAccess=true", async () => {
      vi.mocked(mockApi.getContent).mockResolvedValue({
        id: contentId,
        access: ContentAccess.ViewPublicEditPrivate,
      } as ContentResponse);

      const accessControl: ConnectCloudAccessControl = {
        organizationAccess: "editor",
      };

      const access = await getAccess(
        mockApi,
        false,
        accountId,
        contentId,
        accessControl,
      );

      expect(access).toBe(ContentAccess.ViewPublicEditTeam);
      expect(mockApi.getContent).toHaveBeenCalledWith(contentId);
    });

    it("merges only publicAccess=true with existing ViewPrivateEditPrivate", async () => {
      vi.mocked(mockApi.getContent).mockResolvedValue({
        id: contentId,
        access: ContentAccess.ViewPrivateEditPrivate,
      } as ContentResponse);

      const access = await getAccess(mockApi, false, accountId, contentId, {
        publicAccess: true,
      });

      expect(access).toBe(ContentAccess.ViewPublicEditPrivate);
      expect(mockApi.getContent).toHaveBeenCalledWith(contentId);
    });

    it("merges only publicAccess=false with existing ViewPublicEditPrivate", async () => {
      vi.mocked(mockApi.getContent).mockResolvedValue({
        id: contentId,
        access: ContentAccess.ViewPublicEditPrivate,
      } as ContentResponse);

      const access = await getAccess(mockApi, false, accountId, contentId, {
        publicAccess: false,
      });

      expect(access).toBe(ContentAccess.ViewPrivateEditPrivate);
      expect(mockApi.getContent).toHaveBeenCalledWith(contentId);
    });

    it("merges only publicAccess=true with existing ViewTeamEditTeam", async () => {
      vi.mocked(mockApi.getContent).mockResolvedValue({
        id: contentId,
        access: ContentAccess.ViewTeamEditTeam,
      } as ContentResponse);

      const access = await getAccess(mockApi, false, accountId, contentId, {
        publicAccess: true,
      });

      expect(access).toBe(ContentAccess.ViewPublicEditTeam);
      expect(mockApi.getContent).toHaveBeenCalledWith(contentId);
    });

    it("merges only publicAccess=false with existing ViewTeamEditTeam", async () => {
      vi.mocked(mockApi.getContent).mockResolvedValue({
        id: contentId,
        access: ContentAccess.ViewTeamEditTeam,
      } as ContentResponse);

      const access = await getAccess(mockApi, false, accountId, contentId, {
        publicAccess: false,
      });

      expect(access).toBe(ContentAccess.ViewTeamEditTeam);
      expect(mockApi.getContent).toHaveBeenCalledWith(contentId);
    });

    it("merges only orgAccess=disabled with existing ViewPublicEditPrivate", async () => {
      vi.mocked(mockApi.getContent).mockResolvedValue({
        id: contentId,
        access: ContentAccess.ViewPublicEditPrivate,
      } as ContentResponse);

      const access = await getAccess(mockApi, false, accountId, contentId, {
        organizationAccess: "disabled",
      });

      expect(access).toBe(ContentAccess.ViewPublicEditPrivate);
      expect(mockApi.getContent).toHaveBeenCalledWith(contentId);
    });
  });
});

describe("buildCreateContentRequest", () => {
  it("builds a complete create request", () => {
    const config: ConfigurationDetails = {
      $schema: "https://example.com/schema",
      productType: ProductType.CONNECT_CLOUD,
      type: ContentType.PYTHON_DASH,
      title: "My Dashboard",
      description: "A test dashboard",
      entrypoint: "app.py",
      python: {
        version: "3.10.0",
        packageFile: "requirements.txt",
        packageManager: "pip",
      },
      environment: {
        ENV_VAR: "value1",
      },
      connectCloud: {
        vanityName: "my-dashboard",
      },
      connect: {
        runtime: {
          connectionTimeout: 10,
          readTimeout: 20,
          maxProcesses: 5,
        },
      },
      validate: true,
    };

    const secrets = {
      SECRET_KEY: "secret123",
    };

    const request = buildCreateContentRequest(
      config,
      "my-dashboard",
      secrets,
      "account-123",
      ContentAccess.ViewPublicEditPrivate,
    );

    expect(request.account_id).toBe("account-123");
    expect(request.title).toBe("My Dashboard");
    expect(request.description).toBe("A test dashboard");
    expect(request.access).toBe(ContentAccess.ViewPublicEditPrivate);
    expect(request.vanity_name).toBe("my-dashboard");
    expect(request.content_type).toBe(CloudContentType.Dash);

    expect(request.next_revision).toBeDefined();
    expect(request.next_revision?.source_type).toBe("bundle");
    expect(request.next_revision?.python_version).toBe("3.10.0");
    expect(request.next_revision?.content_type).toBe(CloudContentType.Dash);
    expect(request.next_revision?.primary_file).toBe("app.py");

    expect(request.next_revision?.connect_options).toBeDefined();
    expect(request.next_revision?.connect_options?.conn_timeout).toBe(10);
    expect(request.next_revision?.connect_options?.read_timeout).toBe(20);
    expect(request.next_revision?.connect_options?.sched_max_proc).toBe(5);

    expect(request.secrets).toHaveLength(2);
    const secretsMap = Object.fromEntries(
      request.secrets!.map((s) => [s.name, s.value]),
    );
    expect(secretsMap.ENV_VAR).toBe("value1");
    expect(secretsMap.SECRET_KEY).toBe("secret123");
  });

  it("uses saveName when title is not provided", () => {
    const config: ConfigurationDetails = {
      $schema: "https://example.com/schema",
      productType: ProductType.CONNECT_CLOUD,
      type: ContentType.PYTHON_DASH,
      entrypoint: "app.py",
      validate: true,
    };

    const request = buildCreateContentRequest(
      config,
      "my-save-name",
      undefined,
      "account-123",
      ContentAccess.ViewPrivateEditPrivate,
    );

    expect(request.title).toBe("my-save-name");
  });
});

describe("buildUpdateContentRequest", () => {
  it("builds a complete update request with revision_overrides", () => {
    const config: ConfigurationDetails = {
      $schema: "https://example.com/schema",
      productType: ProductType.CONNECT_CLOUD,
      type: ContentType.R_SHINY,
      title: "My Shiny App",
      description: "Updated description",
      entrypoint: "app.R",
      validate: true,
    };

    const request = buildUpdateContentRequest(
      config,
      "my-app",
      undefined,
      ContentID("content-456"),
      ContentAccess.ViewTeamEditTeam,
    );

    expect(request.content_id).toBe("content-456");
    expect(request.title).toBe("My Shiny App");
    expect(request.description).toBe("Updated description");
    expect(request.access).toBe(ContentAccess.ViewTeamEditTeam);

    expect(request.next_revision).toBeUndefined();
    expect(request.revision_overrides).toBeDefined();
    expect(request.revision_overrides?.source_type).toBe("bundle");
    expect(request.revision_overrides?.content_type).toBe(
      CloudContentType.Shiny,
    );
    expect(request.revision_overrides?.primary_file).toBe("app.R");
  });

  it("handles undefined access for redeploy", () => {
    const config: ConfigurationDetails = {
      $schema: "https://example.com/schema",
      productType: ProductType.CONNECT_CLOUD,
      type: ContentType.HTML,
      validate: true,
    };

    const request = buildUpdateContentRequest(
      config,
      "static-site",
      undefined,
      ContentID("content-789"),
      undefined,
    );

    expect(request.access).toBeUndefined();
  });
});
