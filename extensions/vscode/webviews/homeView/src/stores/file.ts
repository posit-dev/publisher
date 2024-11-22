import { defineStore } from "pinia";
import { computed, ref } from "vue";

import { useHomeStore } from "src/stores/home";
import { useHostConduitService } from "src/HostConduitService";
import { flattenFiles } from "src/utils/files";

import { ContentRecordFile } from "../../../../src/api/types/files";
import { WebviewToHostMessageType } from "../../../../src/types/messages/webviewToHostMessages";

export const useFileStore = defineStore("file", () => {
  const home = useHomeStore();
  const { sendMsg } = useHostConduitService();

  const files = ref<ContentRecordFile>();

  const flatFiles = computed(() => flattenFiles(files.value?.files || []));

  const lastDeployedFiles = computed((): Set<string> => {
    if (home.selectedContentRecord?.state !== "new") {
      return new Set(home.selectedContentRecord?.files);
    }
    return new Set();
  });

  function refreshFiles() {
    sendMsg({ kind: WebviewToHostMessageType.REQUEST_FILES_LISTS });
  }

  function includeFile({ id }: Pick<ContentRecordFile, "id">) {
    sendMsg({
      kind: WebviewToHostMessageType.INCLUDE_FILE,
      content: { path: id },
    });
  }

  function excludeFile({ id }: Pick<ContentRecordFile, "id">) {
    sendMsg({
      kind: WebviewToHostMessageType.EXCLUDE_FILE,
      content: { path: id },
    });
  }

  function openFile({ id }: Pick<ContentRecordFile, "id">) {
    sendMsg({
      kind: WebviewToHostMessageType.VSCODE_OPEN_RELATIVE,
      content: { relativePath: id },
    });
  }

  return {
    files,
    lastDeployedFiles,
    flatFiles,
    refreshFiles,
    includeFile,
    excludeFile,
    openFile,
  };
});
