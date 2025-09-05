import { reactive } from "vue";
import { vi } from "vitest";

// Internal holders (avoid require on aliased paths)
let __setHomeState;
let __resetHomeState;
let __sendMsgMock;

vi.mock("src/stores/home", () => {
  const state = reactive({
    serverSettings: {},
    integrationRequests: [],
  });

  __setHomeState = (partial) => {
    if (partial.serverSettings) state.serverSettings = partial.serverSettings;
    if (partial.integrationRequests !== undefined) {
      state.integrationRequests = partial.integrationRequests;
    }
  };
  __resetHomeState = () => {
    state.serverSettings = {};
    state.integrationRequests = [];
  };

  return {
    useHomeStore: () => state,
  };
});

vi.mock("src/HostConduitService", () => {
  __sendMsgMock = vi.fn();
  return {
    useHostConduitService: () => ({ sendMsg: __sendMsgMock }),
  };
});

// Re-export helpers for tests
export const setHomeState = (p) => __setHomeState(p);
export const resetHomeState = () => __resetHomeState();
export const getSendMsgMock = () => __sendMsgMock;
