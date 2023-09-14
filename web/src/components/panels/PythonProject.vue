<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <LayoutPanel
    title="Python"
    icon="img:images/python-logo-only.svg"
    subtitle="Python v3.8.15 and 16 package dependencies"
    group="main"
  >
    <div>
      <div style="" class="q-ma-sm">
        Your project is using Python version 3.8.15.
      </div>
      <div class="row justify-between align-top q-ma-sm q-mt-md">
        <div>
          Packages required for runtime:
        </div>
        <q-markup-table dark flat dense bordered style="min-width: 400px;" separator="horizontal">
          <thead>
            <tr>
              <th class="text-left text-bold">Package Name</th>
              <th class="text-left text-bold">Version</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="text-left">aiofiles</td>
              <td class="text-left">v3.2.1</td>
            </tr>
            <tr>
              <td class="text-left">anyio</td>
              <td class="text-left">v3.6.2</td>
            </tr>
            <tr>
              <td class="text-left">asgiref</td>
              <td class="text-left">v3.6.0</td>
            </tr>
            <tr>
              <td class="text-left">click</td>
              <td class="text-left">v8.1.3</td>
            </tr>
            <tr>
              <td class="text-left">fastapi</td>
              <td class="text-left">v0.95.2</td>
            </tr>
            <tr>
              <td class="text-left">h11</td>
              <td class="text-left">v0.14.0</td>
            </tr>
            <tr>
              <td class="text-left">idna</td>
              <td class="text-left">v3.4</td>
            </tr>
            <tr>
              <td class="text-left">pydantic</td>
              <td class="text-left">v1.10.7</td>
            </tr>
            <tr>
              <td class="text-left">PyJWT</td>
              <td class="text-left">v2.7.0</td>
            </tr>
            <tr>
              <td class="text-left">semver</td>
              <td class="text-left">v2.13.0</td>
            </tr>
            <tr>
              <td class="text-left">six</td>
              <td class="text-left">v1.16.0</td>
            </tr>
            <tr>
              <td class="text-left">sniffio</td>
              <td class="text-left">v1.3.0</td>
            </tr>
            <tr>
              <td class="text-left">starlette</td>
              <td class="text-left">v0.27.0</td>
            </tr>
            <tr>
              <td class="text-left">typing_extensions</td>
              <td class="text-left">v4.5.0</td>
            </tr>
            <tr>
              <td class="text-left">uvicorn</td>
              <td class="text-left">v0.22.0</td>
            </tr>
            <tr>
              <td class="text-left">websockets</td>
              <td class="text-left">v11.0.3</td>
            </tr>
          </tbody>
        </q-markup-table>
      </div>

      
    </div>
  </LayoutPanel>
</template>

<script setup lang="ts">
import LayoutPanel from 'src/components/LayoutPanel.vue';
</script>

