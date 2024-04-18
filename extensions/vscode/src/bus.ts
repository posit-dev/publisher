// Copyright (C) 2024 by Posit Software, PBC.

import { Omnibus, args } from "@hypersphere/omnibus";
import { HomeViewSelectionState } from "./views/homeView";

export const bus = Omnibus.builder()
  // activeParams: event broadcasting the entire set of HomeView selection state
  .register("activeParams", args<HomeViewSelectionState>())

  // activeDeploymentChanged: triggered if deployment name has changed
  // or if represents the initial value message (where changed is undefined)
  .derive("activeDeploymentChanged", "activeParams", (b) =>
    b.filter(
      (activeParams) =>
        activeParams?.deploymentNameChanged ||
        activeParams?.deploymentNameChanged === undefined,
    ),
  )

  // activeConfigurationChanged: triggered if deployment name has changed
  // or if represents the initial value message (where changed is undefined)
  .derive("activeConfigurationChanged", "activeParams", (b) =>
    b.filter(
      (activeParams) =>
        activeParams?.configurationNameChanged ||
        activeParams?.configurationNameChanged === undefined,
    ),
  )

  // activeCredentialChanged: triggered if deployment name has changed
  // or if represents the initial value message (where changed is undefined)
  .derive("activeCredentialChanged", "activeParams", (b) =>
    b.filter(
      (activeParams) =>
        activeParams?.credentialNameChanged ||
        activeParams?.credentialNameChanged === undefined,
    ),
  )

  // requestActiveParams: simple event which will cause the ActiveParams event to be sent back out. This allows us
  .register("requestActiveParams", args<undefined>())
  .build();

export const useBus = () => {
  return bus;
};
