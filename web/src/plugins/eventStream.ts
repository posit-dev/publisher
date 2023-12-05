// Copyright (C) 2023 by Posit Software, PBC.

// eslint-disable-next-line @typescript-eslint/no-shadow
import { InjectionKey, Plugin, inject } from 'vue';

import { EventStream } from 'src/api/resources/EventStream';

// Add $eventStream to the Vue global properties type
declare module 'vue' {
  interface ComponentCustomProperties {
    $eventStream: EventStream
  }
}

const eventStreamKey = Symbol('EventStream') as InjectionKey<EventStream>;

const eventStream: Plugin = {
  install: (app) => {
    const stream = new EventStream();
    app.config.globalProperties.$eventStream = stream;
    app.provide(eventStreamKey, stream);
  }
};

/**
 * Composable to use the $eventStream global property.
 * @returns {EventStream} Global $eventStream property.
 */
export function useEventStream(): EventStream {
  const stream = inject(eventStreamKey);
  if (!stream) {
    throw new Error(`eventStream not provided, use the eventStream plugin.`);
  }
  return stream;
}

// eslint-disable-next-line no-restricted-syntax
export default eventStream;
