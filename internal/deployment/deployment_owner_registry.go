package deployment

import "sync"

// Copyright (C) 2023 by Posit Software, PBC.
type DeploymentOwnerRegistry struct {
	sync.RWMutex
	m map[string]string
}

var ActiveDeploymentRegistry DeploymentOwnerRegistry = DeploymentOwnerRegistry{
	m: make(map[string]string),
}

func (o *DeploymentOwnerRegistry) Set(deploymentPath string, localId string) {
	o.Lock()
	defer o.Unlock()

	o.m[deploymentPath] = localId
}

func (o *DeploymentOwnerRegistry) Check(deploymentPath string, localId string) bool {
	o.Lock()
	defer o.Unlock()

	owner := o.m[deploymentPath]
	return owner == localId
}

func (o *DeploymentOwnerRegistry) Reset() {
	o.Lock()
	defer o.Unlock()

	o.m = make(map[string]string)
}
