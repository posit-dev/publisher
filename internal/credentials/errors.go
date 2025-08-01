// Copyright (C) 2024 by Posit Software, PBC.

package credentials

import (
	"fmt"

	"github.com/posit-dev/publisher/internal/types"
)

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

// Credential has already been defined
type CredentialIdentityCollision struct {
	Name        string
	URL         string
	AccountName string
}

func NewIdentityCollisionError(name, url, accountName string) *CredentialIdentityCollision {
	return &CredentialIdentityCollision{Name: name, URL: url, AccountName: accountName}
}

func (e *CredentialIdentityCollision) Error() string {
	msg := fmt.Sprintf("URL value conflicts with existing credential (%s) URL: %s", e.Name, e.URL)
	if e.AccountName != "" {
		msg += fmt.Sprintf(", account name: %s", e.AccountName)
	}
	return msg
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
	return "New credentials require non-empty Name, URL, Server Type, and either API Key, Snowflake, or Connect Cloud connection fields"
}

func NewBackupFileAgentError(filename string, err error) *types.AgentError {
	details := types.ErrorCredentialsCannotBackupFileDetails{
		Filename: filename,
		Message:  fmt.Sprintf("Failed to backup credentials to %s: %v", filename, err.Error()),
	}
	return types.NewAgentError(types.ErrorCredentialsCannotBackupFile, err, details)
}
