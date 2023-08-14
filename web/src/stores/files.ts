// Copyright (C) 2023 by Posit Software, PBC.

import { defineStore } from 'pinia';

interface FilesState {
  filesToPublish: string[];
}

export const useFilesStore = defineStore('files', {
  state: (): FilesState => ({
    filesToPublish: []
  }),
});
