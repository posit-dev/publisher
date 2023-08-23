// Copyright (C) 2023 by Posit Software, PBC.

export enum EventSourceReadyState {
  CONNECTING = 0,
  OPEN = 1,
  CLOSED = 2,
}

export const isSomeStringEnum =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  <T>(e: T) => (token: any): token is T[keyof T] => Object.values(e).includes(token as T[keyof T]);

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

  'open/*' | // open events
  'open/sse' |

  'errors/*' |
  'errors/open' | // SSE open error
  'errors/unknown' |
  'errors/fileSystem' |
  'errors/initialization' |
  'errors/unknownEvent' |

  'runtime/*' | // all runtime events

  'runtime/process/*' | // all process runtime events
  'runtime/process/agentInitComplete' |
  'runtime/process/agentExit' |

  'publishing/*' | // all publishing events

  'publishing/**/log' | // all log messages, across all stages

  'publishing/appCreation/*' |
  'publishing/appCreation/log' |
  'publishing/appCreation/success' |
  'publishing/appCreation/failure/*' |
  'publishing/appCreation/failure/unknown' |
  'publishing/appCreation/failure/auth' |
  'publishing/appCreation/failure/timeout' |

  'publishing/upload/*' |
  'publishing/upload/start' |
  'publishing/upload/log' |
  'publishing/upload/success' |
  'publishing/upload/failure/*' |
  'publishing/upload/failure/unknown' |
  'publishing/upload/failure/fileAccess' |
  'publishing/upload/failure/timeout' |

  'publishing/restore/*' |
  'publishing/restore/start' |
  'publishing/restore/log' |
  'publishing/restore/success' |
  'publishing/restore/failure/*' |
  'publishing/restore/failure/unknown' |
  'publishing/restore/failure/dependencyInstallError' |
  'publishing/restore/failure/dependencyDownloadError' |

  'publishing/basicSettings/*' |
  'publishing/basicSettings/start' |
  'publishing/basicSettings/log' |
  'publishing/basicSettings/success' |
  'publishing/basicSettings/failure/*' |
  'publishing/basicSettings/failure/unknown' |
  'publishing/basicSettings/failure/vanityUrlNotAvailable' |
  'publishing/basicSettings/failure/thumbnailInvalid' |

  'publishing/advancedSettings/*' |
  'publishing/advancedSettings/start' |
  'publishing/advancedSettings/log' |
  'publishing/advancedSettings/success' |
  'publishing/advancedSettings/failure/*' |
  'publishing/advancedSettings/failure/unknown' |
  'publishing/advancedSettings/failure/invalidImageName' |
  'publishing/advancedSettings/failure/invalidUser' |

  'publishing/complete';
