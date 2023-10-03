import { Ref } from 'vue';

import { EventStream } from 'src/api/resources/EventStream';
import { EventStreamMessage } from 'src/api/types/events';

export const sseKey = Symbol('Key for Server Side Events Vue Provide / Inject');

export type SSE = {
  stream: EventStream,
  events: Ref<EventStreamMessage[]>
}
