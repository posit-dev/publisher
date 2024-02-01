<!-- Copyright (C) 2024 by Posit Software, PBC. -->

<template>
  <div class="publisher-layout q-py-md">
    <q-breadcrumbs>
      <q-breadcrumbs-el>
        <PLink :to="{ name: 'project' }">
          Project
        </PLink>
      </q-breadcrumbs-el>
      <q-breadcrumbs-el
        label="Agent Log"
      />
    </q-breadcrumbs>
    <div class="q-pt-lg">
      <q-checkbox
        v-model="showDebug"
        class="q-pl-none"
        label="Include Debug Level Log Messages"
        left-label
      />
      <template
        v-for="logMsg in eventStore.agentLogs"
        :key="logMsg"
      >
        <template
          v-if="logMsg.data.level !== 'DEBUG' || (logMsg.data.type !== 'DEBUG' && showDebug)"
        >
          <hr>
          <div class="row row-gap-md q-py-sm logMsg">
            <div class="col-12 col-sm-2">
              <div class="row">
                {{ formatDateString(logMsg.time, { includeTime: false }) }}
              </div>
              <div class="row">
                {{ formatTimeString(logMsg.time, { includeSeconds: true }) }}
              </div>
            </div>
            <div class="col-12 col-sm-10">
              <template
                v-for="key in Object.keys(logMsg.data)"
                :key="key"
              >
                <div
                  v-if="logMsg.data[key]"
                  class="row"
                >
                  <span style="font-weight: bold;">
                    {{ key }}:
                  </span>
                  {{ logMsg.data[key] }}
                </div>
              </template>
            </div>
          </div>
        </template>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import PLink from 'src/components/PLink.vue';

import { useEventStore } from 'src/stores/events';
import { formatDateString, formatTimeString } from 'src/utils/date';
import { ref } from 'vue';

const eventStore = useEventStore();

const showDebug = ref(false);

</script>

<style scoped lang="scss">
.logMsg {
  font-family: monospace;
  font-size: smaller;
}
</style>
