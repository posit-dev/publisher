// Copyright (C) 2026 by Posit Software, PBC.

import { createPinia, setActivePinia } from "pinia";
import { shallowMount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { GUID } from "@posit-dev/connect-api";
import Credentials from "./Credentials.vue";
import TreeItem from "../tree/TreeItem.vue";
import { useHomeStore } from "../../stores/home";
import {
  CONNECT_SESSION_CREDENTIAL_GUID,
  CONNECT_SESSION_CREDENTIAL_NAME,
  type Credential,
} from "../../../../../src/api/types/credentials";
import { ServerType } from "../../../../../src/api/types/contentRecords";

vi.mock(import("src/vscode"));
vi.mock("src/HostConduitService", () => ({
  useHostConduitService: () => ({ sendMsg: vi.fn() }),
}));

describe("Connect session credentials", () => {
  it("hides deletion for the managed credential and keeps it for saved credentials", () => {
    setActivePinia(createPinia());
    const session: Credential = {
      guid: CONNECT_SESSION_CREDENTIAL_GUID,
      name: CONNECT_SESSION_CREDENTIAL_NAME,
      url: "https://connect.example.com",
      apiKey: "",
      snowflakeConnection: "",
      accountId: "",
      accountName: "",
      refreshToken: "",
      accessToken: "",
      cloudEnvironment: "",
      token: "",
      privateKey: "",
      oauthClientId: "",
      tokenExpiresAt: "",
      serverType: ServerType.CONNECT,
    };
    const home = useHomeStore();
    home.credentials = [
      session,
      { ...session, guid: GUID("saved-guid"), name: "A saved credential" },
    ];
    const wrapper = shallowMount(Credentials, {
      global: { renderStubDefaultSlot: true },
    });
    const items = wrapper.findAllComponents(TreeItem);
    expect(
      items
        .find((item) => item.props("title") === session.name)
        ?.props("actions"),
    ).toEqual([]);
    expect(
      items
        .find((item) => item.props("title") === "A saved credential")
        ?.props("actions"),
    ).toEqual([expect.objectContaining({ label: "Delete Credential" })]);
    expect(home.credentials[0]?.guid).toBe(CONNECT_SESSION_CREDENTIAL_GUID);
  });
});
