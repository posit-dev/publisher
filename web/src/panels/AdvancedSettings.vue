<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <q-expansion-item>
    <template #header>
      <q-item-section avatar>
        <q-icon
          name="img:assets/images/settings.png"
          size="35px"
        />
      </q-item-section>

      <q-item-section>
        <q-item-label>Advanced Settings</q-item-label>
        <q-item-label caption>
          Using defaults...
        </q-item-label>
      </q-item-section>
    </template>

    <q-card class="bg-grey-9">
      <q-card-section>
        TODO: Show list of editable settings (and some as read-only)
        based on capabilities of target server. <br><br>
        QUESTION: Do we save updated settings when server target changes
        and the capabilities no longer allow the setting? (We save so that
        we can restore back?)
      </q-card-section>
    </q-card>
  </q-expansion-item>
</template>
