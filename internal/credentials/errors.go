// Copyright (C) 2024 by Posit Software, PBC.

package credentials

import "fmt"

type CorruptedError struct {
	GUID string
}

func NewCorruptedError(guid string) *CorruptedError {
	return &CorruptedError{guid}
}

func (e *CorruptedError) Error() string {
	return fmt.Sprintf("credential '%s' is corrupted", e.GUID)
}

func (e *CorruptedError) Is(target error) bool {
	_, isCorrupterErr := target.(*CorruptedError)
	return isCorrupterErr
}

type LoadError struct {
	Err error
}

func NewLoadError(err error) *LoadError {
	return &LoadError{err}
}

func (e *LoadError) Error() string {
	return fmt.Sprintf("failed to load credentials: %v", e.Err)
}

func (e *LoadError) Is(target error) bool {
	_, isLoadErr := target.(*LoadError)
	return isLoadErr
}

type NotFoundError struct {
	GUID string
}

func NewNotFoundError(guid string) *NotFoundError {
	return &NotFoundError{GUID: guid}
}

func (e *NotFoundError) Error() string {
	return fmt.Sprintf("credential not found: %s", e.GUID)
}

// URL is used by another credential
type URLCollisionError struct {
	Name string
	URL  string
}

func NewURLCollisionError(name, url string) *URLCollisionError {
	return &URLCollisionError{name, url}
}

func (e *URLCollisionError) Error() string {
	return fmt.Sprintf("URL value conflicts with existing credential (%s) URL: %s", e.Name, e.URL)
}

// Name is used by another credential
type NameCollisionError struct {
	Name string
	URL  string
}

func NewNameCollisionError(name, url string) *NameCollisionError {
	return &NameCollisionError{name, url}
}

func (e *NameCollisionError) Error() string {
	return fmt.Sprintf("Name value conflicts with existing credential (%s) URL: %s", e.Name, e.URL)
}

type VersionError struct {
	Version uint
}

func NewVersionError(v uint) *VersionError {
	return &VersionError{v}
}

func (e *VersionError) Error() string {
	return fmt.Sprintf("credential version not supported: %d", e.Version)
}

type IncompleteCredentialError struct{}

func NewIncompleteCredentialError() *IncompleteCredentialError {
	return &IncompleteCredentialError{}
}

func (e *IncompleteCredentialError) Error() string {
	return "New credentials require non-empty Name, URL and Api Key fields"
}
