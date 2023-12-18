<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <div>
    <template v-if="isConfigurationError(config)">
      {{ config.error }}
    </template>

    <template v-else>
      <div class="space-between-sm">
        <ConfigType :type="config.configuration.type" />
        <ConfigEntrypoint :entrypoint="config.configuration.entrypoint" />
        <ConfigTitle :title="config.configuration.title" />
        <ConfigDescription :description="config.configuration.description" />
        <ConfigThumbnail :thumbnail="config.configuration.thumbnail" />
        <ConfigTags :tags="config.configuration.tags" />
      </div>
      <ConfigPython :python="config.configuration.python" />
      <ConfigR :r="config.configuration.r" />
      <ConfigQuarto :quarto="config.configuration.quarto" />
      <ConfigEnvironment :environment="config.configuration.environment" />
      <ConfigSecrets :secrets="config.configuration.secrets" />
      <ConfigSchedules :schedules="config.configuration.schedules" />
      <ConfigAccess :access="config.configuration.access" />
      <ConfigConnect :connect="config.configuration.connect" />
    </template>
  </div>
</template>

<script setup lang="ts">
import { PropType } from 'vue';

import { Configuration, ConfigurationError, isConfigurationError } from 'src/api/types/configurations';
import ConfigType from 'src/components/config/ConfigType.vue';
import ConfigEntrypoint from 'src/components/config/ConfigEntrypoint.vue';
import ConfigTitle from 'src/components/config/ConfigTitle.vue';
import ConfigDescription from 'src/components/config/ConfigDescription.vue';
import ConfigThumbnail from 'src/components/config/ConfigThumbnail.vue';
import ConfigTags from 'src/components/config/ConfigTags.vue';
import ConfigPython from 'src/components/config/ConfigPython.vue';
import ConfigR from 'src/components/config/ConfigR.vue';
import ConfigQuarto from 'src/components/config/ConfigQuarto.vue';
import ConfigEnvironment from 'src/components/config/ConfigEnvironment.vue';
import ConfigSecrets from 'src/components/config/ConfigSecrets.vue';
import ConfigSchedules from 'src/components/config/ConfigSchedules.vue';
import ConfigAccess from 'src/components/config/ConfigAccess.vue';
import ConfigConnect from 'src/components/config/ConfigConnect.vue';

defineProps({
  config: {
    type: Object as PropType<Configuration | ConfigurationError>,
    required: true,
  },
});
</script>
