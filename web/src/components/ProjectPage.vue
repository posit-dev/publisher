<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <h1>Project Page</h1>
</template>

<script setup lang="ts">
import { useApi } from 'src/api';

const api = useApi();
api.deployments.get();
</script>
