// Copyright (C) 2023 by Posit Software, PBC.

import { defineStore } from 'pinia';
import { computed } from 'vue';
import { useQuasar } from 'quasar';

export const useColorStore = defineStore('color', () => {
  const $q = useQuasar();

  const palette = {
    dark: {
      icon: {
        fill: '#D3D3D3',
        stroke: 'none',
      },
      logo: {
        fill: '#F8F8FF',
        stroke: 'none',
      },
      expansion: {
        header: {
          open: {
            background: '#303030',
            text: '#F8F8FF',
          },
          closed: {
            background: 'black',
            text: '#F8F8FF',
          },
        },
        card: {
          background: '#303030',
          text: '#F8F8FF',
        },
      },
    },
    light: {
      icon: {
        fill: 'darkslategrey',
        stroke: 'none',
      },
      logo: {
        fill: '#E6EDF3',
        stroke: 'none',
      },
      expansion: {
        header: {
          open: {
            background: '#F5F5F5',
            text: 'black',
          },
          closed: {
            background: 'white',
            text: 'black',
          },
        },
        card: {
          background: '#F5F5F5',
          text: 'black',
        },
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
