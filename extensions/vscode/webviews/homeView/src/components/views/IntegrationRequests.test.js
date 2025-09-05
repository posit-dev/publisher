import { describe, it, expect, beforeEach } from "vitest";
import { shallowMount, mount } from "@vue/test-utils"; // added mount
import { WebviewToHostMessageType } from "../../../../../src/types/messages/webviewToHostMessages";
import {
  setHomeState,
  resetHomeState,
  getSendMsgMock,
} from "../../test/mocks";
import IntegrationRequests from "./IntegrationRequests.vue";

function mountComponent(opts = { shallow: true }) {
  const fn = opts.shallow ? shallowMount : mount;
  return fn(IntegrationRequests);
}

describe("IntegrationRequests", () => {
  let sendMsg;

  beforeEach(() => {
    resetHomeState();
    sendMsg = getSendMsgMock();
    sendMsg.mockReset();
  });

  it("shows unsupported state (no actions, no items) when OAuth integrations not supported", () => {
    setHomeState({
      serverSettings: {
        license: { "oauth-integrations": false },
        oauth_integrations_enabled: false,
      },
      integrationRequests: [],
    });

    const wrapper = mountComponent();

    const section = wrapper.findComponent({ name: "TreeSection" });
    expect(section.exists()).toBe(true);
    expect(section.props("actions")).toEqual([]);

    // No TreeItem components
    expect(wrapper.findAllComponents({ name: "TreeItem" }).length).toBe(0);

    // sectionActions computed should be empty
    expect(wrapper.vm.sectionActions).toEqual([]);
  });

  it("exposes add action when supported but no integration requests", () => {
    setHomeState({
      serverSettings: {
        license: { "oauth-integrations": true },
        oauth_integrations_enabled: true,
      },
      integrationRequests: [],
    });

    const wrapper = mountComponent();

    const section = wrapper.findComponent({ name: "TreeSection" });
    const actions = section.props("actions");
    expect(actions.length).toBe(1);
    expect(actions[0].label).toBe("Add Integration Request");

    actions[0].fn();
    expect(sendMsg).toHaveBeenCalledTimes(1);
    expect(sendMsg).toHaveBeenLastCalledWith({
      kind: WebviewToHostMessageType.ADD_INTEGRATION_REQUEST,
    });
  });

  it("renders integration requests and handles delete action via props", () => {
    const requests = [
      { name: "req1", displayName: "Request One", displayDescription: "First" },
      { name: "req2", displayName: "Request Two", displayDescription: "Second" },
    ];
    setHomeState({
      serverSettings: {
        license: { "oauth-integrations": true },
        oauth_integrations_enabled: true,
      },
      integrationRequests: requests,
    });

    const wrapper = mountComponent({ shallow: false }); // use full mount so TreeItem components are present

    const items = wrapper.findAllComponents({ name: "TreeItem" });
    expect(items.length).toBe(2);

    const firstItemActions = items[0].props("actions");
    expect(firstItemActions.length).toBe(1);
    expect(firstItemActions[0].label).toBe("Delete Integration Request");

    firstItemActions[0].fn();

    expect(sendMsg).toHaveBeenCalledTimes(1);
    expect(sendMsg).toHaveBeenLastCalledWith({
      kind: WebviewToHostMessageType.DELETE_INTEGRATION_REQUEST,
      content: { request: requests[0] },
    });
  });
});
