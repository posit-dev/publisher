import { reactive } from "vue";
import { vi, type Mock } from "vitest";

// Internal holders (avoid require on aliased paths)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let __setHomeState: (partial: Record<string, any>) => void;
let __resetHomeState: () => void;
let __sendMsgMock: Mock;
let __fileState: {
  includeFile: Mock;
  excludeFile: Mock;
  openFile: Mock;
  lastDeployedFiles: Set<string>;
};
let __resetFileState: () => void;

vi.mock("src/stores/home", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const state: Record<string, any> = reactive({
    serverSettings: {},
    integrationRequests: [],
    selectedConfiguration: undefined,
    selectedContentRecord: undefined,
  });

  __setHomeState = (partial) => {
    if (partial.serverSettings) state.serverSettings = partial.serverSettings;
    if (partial.integrationRequests !== undefined) {
      state.integrationRequests = partial.integrationRequests;
    }
    if (partial.selectedConfiguration !== undefined) {
      state.selectedConfiguration = partial.selectedConfiguration;
    }
    if (partial.selectedContentRecord !== undefined) {
      state.selectedContentRecord = partial.selectedContentRecord;
    }
  };
  __resetHomeState = () => {
    state.serverSettings = {};
    state.integrationRequests = [];
    state.selectedConfiguration = undefined;
    state.selectedContentRecord = undefined;
  };

  return {
    useHomeStore: () => state,
  };
});

vi.mock("src/stores/file", () => {
  const includeFile = vi.fn();
  const excludeFile = vi.fn();
  const openFile = vi.fn();

  __fileState = {
    includeFile,
    excludeFile,
    openFile,
    lastDeployedFiles: new Set(),
  };
  __resetFileState = () => {
    includeFile.mockReset();
    excludeFile.mockReset();
    openFile.mockReset();
    __fileState.lastDeployedFiles = new Set();
  };

  return {
    useFileStore: () => __fileState,
  };
});

vi.mock("src/HostConduitService", () => {
  __sendMsgMock = vi.fn();
  return {
    useHostConduitService: () => ({ sendMsg: __sendMsgMock }),
  };
});

// Re-export helpers for tests
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const setHomeState = (p: Record<string, any>) => __setHomeState(p);
export const resetHomeState = () => __resetHomeState();
export const getSendMsgMock = () => __sendMsgMock;
export const getFileStore = () => __fileState;
export const resetFileState = () => __resetFileState();
