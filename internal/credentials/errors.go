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
	Name string
	URL  string
}

func (e *URLCollisionError) Error() string {
	return fmt.Sprintf("URL value conflicts with existing credential (%s) URL: %s", e.Name, e.URL)
}

// Environment URL overlaps with Credential URL
type EnvURLCollisionError struct {
	Name string
	URL  string
}

func (e *EnvURLCollisionError) Error() string {
	return fmt.Sprintf("CONNECT_SERVER URL value conflicts with existing credential (%s) URL: %s", e.Name, e.URL)
}

// Name is used by another credential
type NameCollisionError struct {
	Name string
	URL  string
}

func (e *NameCollisionError) Error() string {
	return fmt.Sprintf("Name value conflicts with existing credential (%s) URL: %s", e.Name, e.URL)
}

// Environment URL overlaps with Credential URL
type EnvNameCollisionError struct {
	Name string
	URL  string
}

func (e *EnvNameCollisionError) Error() string {
	return fmt.Sprintf("CONNECT_SERVER Name value conflicts with existing credential (%s) URL: %s", e.Name, e.URL)
}

// Deleting Environment Credentials Not allowed
type EnvURLDeleteError struct {
	GUID string
}

func (e *EnvURLDeleteError) Error() string {
	return fmt.Sprintf("DELETING an environment credential is not allowed. (GUID=%s)", e.GUID)
}

type VersionError struct {
	Version uint
}

func (e *VersionError) Error() string {
	return fmt.Sprintf("credential version not supported: %d", e.Version)
}
