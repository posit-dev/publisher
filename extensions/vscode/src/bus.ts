// Copyright (C) 2024 by Posit Software, PBC.

import { Omnibus, args } from "@hypersphere/omnibus";
import { Configuration, ContentRecord, PreContentRecord } from "src/api";

export const bus = Omnibus.builder()
  // activeContentRecordChanged: triggered if contentRecord name or value has changed
  .register(
    "activeContentRecordChanged",
    args<ContentRecord | PreContentRecord | undefined>(),
  )
  // activeConfigurationChanged: triggered if configuration name or value has changed
  .register("activeConfigChanged", args<Configuration | undefined>())
  // requestActive*: simple events which will cause an Active*Change event to be sent back out.
  .register("requestActiveConfig", args<undefined>())
  .register("requestActiveContentRecord", args<undefined>())
  .register("refreshCredentials", args<undefined>())

  .build();

// Setup message logging
// bus.on(
//   "activeContentRecordChanged",
//   (msg: ContentRecord | PreContentRecord | undefined) => {
//     console.debug(
//       `\nbus trace: activeContentRecordChanged: ${JSON.stringify(msg)}\n`,
//     );
//   },
// );
// bus.on("activeConfigChanged", (msg: Configuration | undefined) => {
//   console.debug(`\nbus trace: activeConfigChanged: ${JSON.stringify(msg)}\n`);
// });
// bus.on("requestActiveConfig", () => {
//   console.debug(`\nbus trace: requestActiveConfig`);
// });
// bus.on("requestActiveContentRecord", () => {
//   console.debug(`\nbus trace: requestActiveContentRecord`);
// });
// bus.on("refreshCredentials", () => {
//   console.debug(`\nbus trace: refreshCredentials`);
// });

export const useBus = () => {
  return bus;
};
