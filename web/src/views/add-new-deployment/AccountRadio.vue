<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <q-item
    tag="label"
    class="q-my-sm row items-center"
    :class="activeClass"
  >
    <q-item-section
      avatar
      top
      class="col-1"
    >
      <q-radio
        v-model="radioModel"
        name="account"
        :val="account.name"
      />
    </q-item-section>
    <q-item-section
      class="q-ml-md"
    >
      <q-item-label>
        {{ account.name }}
      </q-item-label>
      <q-item-label
        caption
        class="account-caption"
      >
        Account: {{ calculateName(account) }}
      </q-item-label>
      <q-item-label
        caption
        class="account-url"
      >
        URL: {{ account.url }}
      </q-item-label>
      <q-item-label
        caption
        class="q-pt-sm account-credential"
      >
        Credentials managed by: {{ account.source }}
      </q-item-label>
    </q-item-section>
  </q-item>
</template>

<script setup lang="ts">
import { PropType, computed } from 'vue';
import { Account } from 'src/api';
import { calculateName } from 'src/utils/accounts';

const emit = defineEmits(['update:modelValue']);
const props = defineProps({
  modelValue: {
    type: String,
    required: true,
  },
  account: {
    type: Object as PropType<Account>,
    required: true,
  },
});

const radioModel = computed({
  get() {
    return props.modelValue;
  },
  set(newValue) {
    emit('update:modelValue', newValue);
  }
});

const selected = computed(() => {
  return props.account.name === props.modelValue;
});

const activeClass = computed(() => {
  return selected.value ? 'account-item-selected' : 'account-item-not-selected';
});

</script>
