// Copyright (C) 2024 by Posit Software, PBC.

import { Omnibus, args } from "@hypersphere/omnibus";
import { Account, Configuration, Deployment, PreDeployment } from "./api";

export const bus = Omnibus.builder()
  // activeDeploymentChanged: triggered if deployment name or value has changed
  .register(
    "activeDeploymentChanged",
    args<Deployment | PreDeployment | undefined>(),
  )
  // activeConfigurationChanged: triggered if configuration name or value has changed
  .register("activeConfigChanged", args<Configuration | undefined>())
  // activeCredentialChanged: triggered if credential name or value has changed
  .register("activeCredentialChanged", args<Account | undefined>())
  // requestActive*: simple events which will cause an Active*Change event to be sent back out.
  .register("requestActiveConfig", args<undefined>())
  .register("requestActiveDeployment", args<undefined>())
  .register("requestActiveCredential", args<undefined>())

  .build();

// Setup message logging
bus.on("activeDeploymentChanged", (msg) => {
  console.debug(
    `\nbus trace: activeDeploymentChanged: ${JSON.stringify(msg)}\n`,
  );
});
bus.on("activeConfigChanged", (msg) => {
  console.debug(`\nbus trace: activeConfigChanged: ${JSON.stringify(msg)}\n`);
});
bus.on("activeCredentialChanged", (msg) => {
  console.debug(`\nbus trace: activeCredentialChanged: ${JSON.stringify(msg)}`);
});
bus.on("requestActiveConfig", (msg) => {
  console.debug(`\nbus trace: requestActiveConfig: ${JSON.stringify(msg)}`);
});
bus.on("requestActiveDeployment", (msg) => {
  console.debug(`\nbus trace: requestActiveDeployment: ${JSON.stringify(msg)}`);
});
bus.on("requestActiveCredential", (msg) => {
  console.debug(`\nbus trace: requestActiveCredential: ${JSON.stringify(msg)}`);
});

export const useBus = () => {
  return bus;
};
