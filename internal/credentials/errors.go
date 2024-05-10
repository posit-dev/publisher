// Copyright (C) 2024 by Posit Software, PBC.

package credentials

import "fmt"

type CorruptedError struct {
	GUID string
}

func (e *CorruptedError) Error() string {
	return fmt.Sprintf("credential '%s' is corrupted", e.GUID)
}

type LoadError struct {
	Err error
}

func (e *LoadError) Error() string {
	return fmt.Sprintf("failed to load credentials: %v", e.Err)
}

type NotFoundError struct {
	GUID string
}

func (e *NotFoundError) Error() string {
	return fmt.Sprintf("credential not found: %s", e.GUID)
}

// URL is used by another credential
type URLCollisionError struct {
	URL string
}

func (e *URLCollisionError) Error() string {
	return fmt.Sprintf("URL already in use: %s", e.URL)
}

type VersionError struct {
	Version uint
}

func (e *VersionError) Error() string {
	return fmt.Sprintf("credential version not supported: %d", e.Version)
}
