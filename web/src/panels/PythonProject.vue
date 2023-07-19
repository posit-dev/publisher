<!-- Copyright (C) 2023 by Posit Software, PBC. -->

<template>
  <q-expansion-item>
    <template #header>
      <q-item-section avatar>
        <q-icon
          name="img:assets/images/python-logo-only.svg"
          size="35px"
        />
      </q-item-section>

      <q-item-section>
        <q-item-label>Python</q-item-label>
        <q-item-label caption>
          Python 3.11 and 18 package dependencies
        </q-item-label>
      </q-item-section>
    </template>

    <q-card class="bg-grey-9">
      <q-card-section>
        TODO: Show detailed python version and list of package dependencies
        with ability to add or remove package dependencies. <br><br>
        QUESTON: Do we allow them to change the target python version?
      </q-card-section>
    </q-card>
  </q-expansion-item>
</template>
