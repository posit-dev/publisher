package state

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"fmt"
	"os"
	"strings"

	"github.com/rstudio/connect-client/internal/apitypes"
)

type ConnectDeployment struct {
	Content     ConnectContent               `kong:"embed"`
	Environment []ConnectEnvironmentVariable `short:"E"`
}

type ConnectContent struct {
	Name               apitypes.ContentName `json:"name"`
	Title              string               `json:"title,omitempty"`
	Description        string               `json:"description,omitempty"`
	AccessType         string               `json:"access_type,omitempty"`
	ConnectionTimeout  apitypes.NullInt32   `json:"connection_timeout"`
	ReadTimeout        apitypes.NullInt32   `json:"read_timeout"`
	InitTimeout        apitypes.NullInt32   `json:"init_timeout"`
	IdleTimeout        apitypes.NullInt32   `json:"idle_timeout"`
	MaxProcesses       apitypes.NullInt32   `json:"max_processes"`
	MinProcesses       apitypes.NullInt32   `json:"min_processes"`
	MaxConnsPerProcess apitypes.NullInt32   `json:"max_conns_per_process" kong:"name='max-connections'"`
	LoadFactor         apitypes.NullFloat64 `json:"load_factor"`
	RunAs              string               `json:"run_as,omitempty"`
	RunAsCurrentUser   apitypes.NullBool    `json:"run_as_current_user"`
	MemoryRequest      apitypes.NullInt64   `json:"memory_request"`
	MemoryLimit        apitypes.NullInt64   `json:"memory_limit"`
	CPURequest         apitypes.NullFloat64 `json:"cpu_request"`
	CPULimit           apitypes.NullFloat64 `json:"cpu_limit"`
	ServiceAccountName string               `json:"service_account_name,omitempty"`
	DefaultImageName   string               `json:"default_image_name,omitempty"`
}

func (d *ConnectDeployment) Merge(other *ConnectDeployment) {
	d.Content.Merge(&other.Content)
	d.Environment = append(d.Environment, other.Environment...)
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

type ConnectEnvironmentVariable struct {
	Name            string              `json:"name"`
	Value           apitypes.NullString `json:"value"`
	fromEnvironment bool
}

// UnmarshalText is called by the CLI to parse values.
// Values are of the form NAME=VALUE to specify a name/value pair,
// or just NAME to specify that VALUE should be pulled from
// the environment at deployment time. The second form is
// recommended for secrets, so the value does not appear
// in logs etc.
func (v *ConnectEnvironmentVariable) UnmarshalText(text []byte) error {
	parts := strings.SplitN(string(text), "=", 2)
	v.Name = parts[0]
	if len(parts) == 1 {
		// Just a name. Pull from the environment so
		// the value never appears on the command line.
		// This is helpful for private values that come
		// from the environment and need to be passed through.
		v.Value = apitypes.NewOptional(os.Getenv(v.Name))
		v.fromEnvironment = true
	} else {
		// Value from the CLI (may be the empty string).
		v.Value = apitypes.NewOptional(parts[1])
		v.fromEnvironment = false
	}
	return nil
}

func (v *ConnectEnvironmentVariable) MarshalText() ([]byte, error) {
	if v.fromEnvironment {
		return []byte(v.Name), nil
	} else {
		s, _ := v.Value.Get()
		return []byte(fmt.Sprintf("%s=%s", v.Name, s)), nil
	}
}

const contentLabel metadataLabel = "content"
const environmentLabel metadataLabel = "environment"

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
	d.Environment = append(d.Environment, envVars...)

	// Populate values for variables whose values are pulled from the environment
	for _, envVar := range d.Environment {
		if !envVar.Value.Valid() {
			envVar.Value = apitypes.NewOptional(os.Getenv(envVar.Name))
			envVar.fromEnvironment = true
		}
	}
	return nil
}
