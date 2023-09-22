// Copyright (C) 2023 by Posit Software, PBC.

export enum EventSourceReadyState {
  CONNECTING = 0,
  OPEN = 1,
  CLOSED = 2,
}

export enum EventStreamMessageType {
  ERROR = 'error',
  LOG = 'log',
}

export type EventStreamMessage = {
  type: EventSubscriptionTarget,
  time: string,
  data: object,
}

export function isEventStreamMessage(o: object): o is EventStreamMessage {
  return (
    'type' in o &&
    'time' in o &&
    'data' in o
  );
}

export type OnMessageEventSourceCallback = (msg: EventStreamMessage) => void;

export type MethodResult = {
  ok: boolean,
  error?: string,
}

export type EventStatus = {
  isOpen?: boolean,
  eventSource: string,
  withCredentials?: boolean,
  readyState?: EventSourceReadyState,
  url: string | null,
  lastError: string | null,
}

export type CallbackQueueEntry = {
  eventType: EventSubscriptionTarget,
  callback: OnMessageEventSourceCallback,
}

export type EventSubscriptionTarget =
  '*' | // all events

  'agent/log' | // agent console log messages

  'errors/*' | // all errors
  'errors/sse' |
  'errors/open' |
  'errors/unknownEvent' |

  'open/*' | // open events
  'open/sse' |

  'publish/createBundle/start' |
  'publish/createBundle/success' |

  'publish/createDeployment/start' |
  'publish/createDeployment/success' |

  'publish/uploadBundle/start' |
  'publish/uploadBundle/success' |

  'publish/deployBundle/start' |
  'publish/deployBundle/success' |

  'publish/**/log' |

  'publish/restorePythonEnv/log' |
  'publish/restorePythonEnv/success' |

  'publish/runContent/log' |
  'publish/runContent/success' |

  'publish/success';
