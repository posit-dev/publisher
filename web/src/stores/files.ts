import { defineStore } from 'pinia';

interface FilesState {
  filesToPublish: string[];
}

export const useFilesStore = defineStore('files', {
  state: (): FilesState => ({
    filesToPublish: []
  }),
});
