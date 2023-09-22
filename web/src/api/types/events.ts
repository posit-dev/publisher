// Copyright (C) 2023 by Posit Software, PBC.

export enum EventSourceReadyState {
  CONNECTING = 0,
  OPEN = 1,
  CLOSED = 2,
}


export enum EventStreamMessageTypes {
  ERROR = 'error',
  LOG = 'log',
}

export type EventStreamMessage = {
  type: EventSubscriptionTargets,
  time: string,
  // needed until we define the real types
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any,
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isEventStreamMessage(o: any): o is EventStreamMessage {
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
  isOpen: boolean | undefined,
  eventSource: string,
  withCredentials: boolean | undefined,
  readyState: EventSourceReadyState | undefined,
  url: string | null,
  lastError: string | null,
}

export type MockMessage = {
  type: string,
  data: string,
}

export type EventSubscriptionTargets =
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
