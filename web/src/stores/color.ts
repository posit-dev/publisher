// Copyright (C) 2023 by Posit Software, PBC.

import { defineStore } from 'pinia';
import { computed } from 'vue';
import { useQuasar } from 'quasar';

export const useColorStore = defineStore('color', () => {
  const $q = useQuasar();

  // use Quasar's colors (From Color List:
  // https://quasar.dev/style/color-palette#color-list
  // and duplicated within utils/colorValues.ts
  // Depending on usage need, can either use that string
  // value into Quasar or can pass hex value by calling
  // colorToHex() utility on it.
  const palette = {
    dark: {
      textInput: {
        active: 'grey-1',
      },
      textError: 'red',
      outline: 'grey-6',
      icon: {
        fill: 'grey-4',
        stroke: 'none',
      },
      logo: {
        fill: 'grey-1',
        stroke: 'none',
      },
      files: {
        controls: 'grey-6',
      },
      destination: {
        outline: 'grey-6',
        background: {
          selected: 'grey-8',
          unSelected: 'black',
        },
        text: 'grey-1',
        caption: 'grey-6',
      },
      expansion: {
        header: {
          open: {
            background: 'grey-8',
            text: 'grey-1',
          },
          closed: {
            background: 'grey-10',
            text: 'grey-1',
          },
        },
        card: {
          background: 'grey-10',
          text: 'grey-1',
        },
      },
      bullet: 'grey-5',
      deploymentMode: {
        toggle: {
          active: {
            background: 'grey-6',
            text: 'grey-10',
          },
          inActive: {
            background: 'grey-10',
            text: 'grey-7',
          },
        },
      },
      progress: {
        inactive: 'grey-5',
        active: 'grey-4',
        done: 'grey-6',
        error: 'red-10',
        text: 'red-10',
        summary: {
          background: 'grey-9',
          text: 'grey-4',
          border: 'grey-6',
        },
        log: {
          background: 'grey-10',
          text: 'grey-6',
          border: 'grey-6',
        }
      },
    },
    light: {
      textInput: {
        active: 'grey-10',
      },
      textError: 'red',
      outline: 'grey-10',
      icon: {
        fill: 'grey-8',
        stroke: 'none',
      },
      logo: {
        fill: 'grey-1',
        stroke: 'none',
      },
      files: {
        controls: 'grey-10',
      },
      destination: {
        outline: 'grey-10',
        background: {
          selected: 'grey-5',
          unSelected: 'grey-1',
        },
        text: 'black',
        caption: 'grey-10',
      },
      expansion: {
        header: {
          open: {
            background: 'grey-3',
            text: 'black',
          },
          closed: {
            background: 'grey-1',
            text: 'black',
          },
        },
        card: {
          background: 'grey-2',
          text: 'black',
        },
      },
      bullet: 'grey-8',
      deploymentMode: {
        toggle: {
          active: {
            background: 'grey-4',
            text: 'black',
          },
          inActive: {
            background: 'grey-1',
            text: 'black',
          },
        },
      },
      progress: {
        inactive: 'grey-5',
        active: 'black',
        done: 'grey-8',
        error: 'red-10',
        text: 'red-10',
        summary: {
          background: 'grey-1',
          text: 'grey-8',
          border: 'grey-8',
        },
        log: {
          background: 'grey-3',
          text: 'grey-8',
          border: 'grey-8',
        }
      },
    }
  };

  const activePallete = computed(() => {
    if ($q.dark.isActive) {
      return palette.dark;
    }
    return palette.light;
  });

  return {
    activePallete,
  };
});
