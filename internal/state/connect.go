package state

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"os"

	"github.com/rstudio/connect-client/internal/types"
)

type ConnectDeployment struct {
	Content     ConnectContent               `json:"content"`
	Environment []ConnectEnvironmentVariable `json:"environment"`
}

type ConnectContent struct {
	Name               types.ContentName `json:"name"`
	Title              string            `json:"title,omitempty"`
	Description        string            `json:"description,omitempty"`
	AccessType         string            `json:"-"`
	ConnectionTimeout  types.NullInt32   `json:"-"`
	ReadTimeout        types.NullInt32   `json:"-"`
	InitTimeout        types.NullInt32   `json:"-"`
	IdleTimeout        types.NullInt32   `json:"-"`
	MaxProcesses       types.NullInt32   `json:"-"`
	MinProcesses       types.NullInt32   `json:"-"`
	MaxConnsPerProcess types.NullInt32   `json:"-"`
	LoadFactor         types.NullFloat64 `json:"-"`
	RunAs              string            `json:"-"`
	RunAsCurrentUser   types.NullBool    `json:"-"`
	MemoryRequest      types.NullInt64   `json:"-"`
	MemoryLimit        types.NullInt64   `json:"-"`
	CPURequest         types.NullFloat64 `json:"-"`
	CPULimit           types.NullFloat64 `json:"-"`
	ServiceAccountName string            `json:"-"`
	DefaultImageName   string            `json:"-"`
}

func (d *ConnectDeployment) Merge(other *ConnectDeployment) {
	d.Content.Merge(&other.Content)
	d.Environment = mergeEnvironments(d.Environment, other.Environment)
}

func mergeEnvironments(oldEnv, newEnv []ConnectEnvironmentVariable) []ConnectEnvironmentVariable {
	for _, newVar := range newEnv {
		found := false
		for i := range oldEnv {
			if oldEnv[i].Name == newVar.Name {
				oldEnv[i].Value = newVar.Value
				found = true
				break
			}
		}
		if !found {
			oldEnv = append(oldEnv, newVar)
		}
	}
	return oldEnv
}

func (d *ConnectContent) Merge(other *ConnectContent) {
	if other.Name != "" {
		d.Name = other.Name
	}
	if other.Title != "" {
		d.Title = other.Title
	}
	if other.Description != "" {
		d.Description = other.Description
	}
	if other.AccessType != "" {
		d.AccessType = other.AccessType
	}
	if other.ConnectionTimeout.Valid() {
		d.ConnectionTimeout = other.ConnectionTimeout
	}
	if other.ReadTimeout.Valid() {
		d.ReadTimeout = other.ReadTimeout
	}
	if other.InitTimeout.Valid() {
		d.InitTimeout = other.InitTimeout
	}
	if other.IdleTimeout.Valid() {
		d.IdleTimeout = other.IdleTimeout
	}
	if other.MaxProcesses.Valid() {
		d.MaxProcesses = other.MaxProcesses
	}
	if other.MinProcesses.Valid() {
		d.MinProcesses = other.MinProcesses
	}
	if other.MaxConnsPerProcess.Valid() {
		d.MaxConnsPerProcess = other.MaxConnsPerProcess
	}
	if other.LoadFactor.Valid() {
		d.LoadFactor = other.LoadFactor
	}
	if other.RunAs != "" {
		d.RunAs = other.RunAs
	}
	if other.RunAsCurrentUser.Valid() {
		d.RunAsCurrentUser = other.RunAsCurrentUser
	}
	if other.MemoryRequest.Valid() {
		d.MemoryRequest = other.MemoryRequest
	}
	if other.MemoryLimit.Valid() {
		d.MemoryLimit = other.MemoryLimit
	}
	if other.CPURequest.Valid() {
		d.CPURequest = other.CPURequest
	}
	if other.CPULimit.Valid() {
		d.CPULimit = other.CPULimit
	}
	if other.ServiceAccountName != "" {
		d.ServiceAccountName = other.ServiceAccountName
	}
	if other.DefaultImageName != "" {
		d.DefaultImageName = other.DefaultImageName
	}
}

const contentLabel MetadataLabel = "content"
const environmentLabel MetadataLabel = "environment"

func (d *ConnectDeployment) save(serializer deploymentSerializer) error {
	err := serializer.Save(contentLabel, &d.Content)
	if err != nil {
		return err
	}

	if len(d.Environment) != 0 {
		envVars := make([]ConnectEnvironmentVariable, len(d.Environment))
		for i, src := range d.Environment {
			envVars[i].Name = src.Name
			// Skip private env var values (ones provided without values on the CLI)
			if !src.fromEnvironment {
				envVars[i].Value = src.Value
			} // else Value is null
		}
		err = serializer.Save(environmentLabel, &envVars)
		if err != nil {
			return err
		}
	}
	return nil
}

func (d *ConnectDeployment) load(serializer deploymentSerializer) error {
	err := serializer.Load(contentLabel, &d.Content)
	if err != nil && !os.IsNotExist(err) {
		return err
	}
	envVars := []ConnectEnvironmentVariable{}
	err = serializer.Load(environmentLabel, &envVars)
	if err != nil && !os.IsNotExist(err) {
		return err
	}
	d.Environment = mergeEnvironments(d.Environment, envVars)

	// Populate values for variables whose values are pulled from the environment
	for i := range d.Environment {
		envVar := &d.Environment[i]
		if !envVar.Value.Valid() {
			envVar.Value = types.NewOptional(os.Getenv(envVar.Name))
			envVar.fromEnvironment = true
		}
	}
	return nil
}
