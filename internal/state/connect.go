package state

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"os"
	"strings"

	"github.com/rstudio/connect-client/internal/apitypes"
)

type ConnectDeployment struct {
	Content     ConnectContent               `embed:""`
	Environment []ConnectEnvironmentVariable `short:"E"`
}

type ConnectContent struct {
	Name               apitypes.ContentName `json:"name"`
	Title              apitypes.NullString  `json:"title"`
	Description        string               `json:"description"`
	AccessType         string               `json:"access_type"`
	ConnectionTimeout  apitypes.NullInt32   `json:"connection_timeout"`
	ReadTimeout        apitypes.NullInt32   `json:"read_timeout"`
	InitTimeout        apitypes.NullInt32   `json:"init_timeout"`
	IdleTimeout        apitypes.NullInt32   `json:"idle_timeout"`
	MaxProcesses       apitypes.NullInt32   `json:"max_processes"`
	MinProcesses       apitypes.NullInt32   `json:"min_processes"`
	MaxConnsPerProcess apitypes.NullInt32   `json:"max_conns_per_process"`
	LoadFactor         apitypes.NullFloat64 `json:"load_factor"`
	RunAs              apitypes.NullString  `json:"run_as"`
	RunAsCurrentUser   bool                 `json:"run_as_current_user" negatable:""`
	MemoryRequest      apitypes.NullInt64   `json:"memory_request"`
	MemoryLimit        apitypes.NullInt64   `json:"memory_limit"`
	CPURequest         apitypes.NullFloat64 `json:"cpu_request"`
	CPULimit           apitypes.NullFloat64 `json:"cpu_limit"`
	ServiceAccountName apitypes.NullString  `json:"service_account_name"`
	DefaultImageName   apitypes.NullString  `json:"default_image_name"`
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
		}
	}
	return nil
}
