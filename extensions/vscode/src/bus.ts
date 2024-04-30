// Copyright (C) 2024 by Posit Software, PBC.

import { Omnibus, args } from "@hypersphere/omnibus";
import { Account, Configuration, Deployment, PreDeployment } from "src/api";

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

  // requestActive*: simple event which will cause an Active*Change event to be sent back out.
  .register("requestActiveConfig", args<undefined>())
  .register("requestActiveDeployment", args<undefined>())
  .register("requestActiveCredential", args<undefined>())
  .build();

export const useBus = () => {
  return bus;
};
