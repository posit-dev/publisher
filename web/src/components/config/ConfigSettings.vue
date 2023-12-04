<template>
  <div>
    <h2>Configuration</h2>
    {{ config?.configurationName }}

    <template v-if="config">
      <template v-if="isConfigurationError(config)">
        {{ config.error }}
      </template>

      <template v-else>
        <div>
          <dt>Content Type</dt>
          <dd>{{ config.configuration.type }}</dd>
        </div>

        <div v-if="config.configuration.entrypoint">
          <dt>Entrypoint</dt>
          <dd>{{ config.configuration.entrypoint }}</dd>
        </div>

        <div v-if="config.configuration.title">
          <dt>Title</dt>
          <dd>{{ config.configuration.title }}</dd>
        </div>

        <div v-if="config.configuration.description">
          <dt>Description</dt>
          <dd>{{ config.configuration.description }}</dd>
        </div>

        <div v-if="config.configuration.thumbnail">
          <dt>Thumbnail</dt>
          <dd>{{ config.configuration.thumbnail }}</dd>
        </div>

        <div v-if="config.configuration.tags">
          <dt>Tags</dt>
          <dd>
            <ul>
              <li
                v-for="tag in config.configuration.tags"
                :key="tag"
              >
                {{ tag }}
              </li>
            </ul>
          </dd>
        </div>

        <div v-if="config.configuration.python">
          <dt>Python</dt>
          <dd>{{ config.configuration.python }}</dd>
        </div>

        <div v-if="config.configuration.r">
          <dt>R</dt>
          <dd>{{ config.configuration.r }}</dd>
        </div>

        <div v-if="config.configuration.quarto">
          <dt>Quarto</dt>
          <dd>{{ config.configuration.quarto }}</dd>
        </div>

        <div v-if="config.configuration.environment">
          <dt>Environment</dt>
          <dd>{{ config.configuration.entrypoint }}</dd>
        </div>

        <div v-if="config.configuration.secrets">
          <dt>Secrets</dt>
          <dd>
            <ul>
              <li
                v-for="secret in config.configuration.secrets"
                :key="secret"
              >
                {{ secret }}
              </li>
            </ul>
          </dd>
        </div>

        <div v-if="config.configuration.schedules">
          <dt>Schedules</dt>
          <dd>{{ config.configuration.schedules }}</dd>
        </div>

        <div v-if="config.configuration.access">
          <dt>Access</dt>
          <dd>{{ config.configuration.access }}</dd>
        </div>

        <div v-if="config.configuration.connect">
          <dt>Connect</dt>
          <dd>{{ config.configuration.connect }}</dd>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { PropType } from 'vue';

import { Configuration, ConfigurationError, isConfigurationError } from 'src/api/types/configurations';

defineProps({
  config: {
    type: Object as PropType<Configuration | ConfigurationError>,
    required: true,
  },
});
</script>
