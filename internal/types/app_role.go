package types

// Copyright (C) 2023 by Posit Software, PBC.

import "fmt"

type AppRole string

const (
	AppRoleOwner  AppRole = "owner"
	AppRoleEditor AppRole = "editor"
	AppRoleViewer AppRole = "viewer"
	AppRoleNone   AppRole = "none"
)

func AppRoleFromString(s string) (AppRole, error) {
	switch s {
	case string(AppRoleOwner):
		return AppRoleOwner, nil
	case string(AppRoleEditor):
		return AppRoleEditor, nil
	case string(AppRoleViewer):
		return AppRoleViewer, nil
	case string(AppRoleNone):
		return AppRoleNone, nil
	default:
		return AppRoleNone, fmt.Errorf("invalid app user role: '%s'", s)
	}
}
