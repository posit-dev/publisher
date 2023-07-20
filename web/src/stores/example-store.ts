// Copyright (C) 2023 by Posit Software, PBC.

import { defineStore } from 'pinia';

export const useCounterStore = defineStore('counter', {
  state: () => ({
    counter: 0
  }),
  getters: {
    doubleCount: state => state.counter * 2
  },
  actions: {
    increment() {
      this.counter++;
    }
  }
});
