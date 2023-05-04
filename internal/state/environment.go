package state

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"fmt"
	"os"
	"strings"

	"github.com/rstudio/connect-client/internal/apitypes"
)

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
