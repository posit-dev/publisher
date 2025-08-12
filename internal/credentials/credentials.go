// Package credentials provides a secure storage and management system for user credentials.
// The service uses the "go-keyring" library to interact with the system's native keyring service.
// For systems that do not support a native keyring service,
// an alternative using a file at ~/.connect-credentials to persist credentials is implemented.
//
// This package is not thread safe! Manipulation of credentials from multiple threads can result in data loss.
// A distributed write lock is required to ensure threads do not overwrite the credential store.
//
// Support for breaking changes to the Credentials schema is supported via version system.
// The current implementation supports a single version (Version 0), but is designed to be extendable to future versions.
// For example, adding a new field to Credential.
//
// Migration instructions:
// - Modify the current version to retain the current Credential structure (i.e., copy the struct of Credential to CredentialV0)
// - Modify Credential to include required changes.
// - Create a new version (e.g., CredentialV1) and assign Credential to it (.e.g, CredentialV1 = Credential)
// - Increment CurrentVersion to match the new version (e.g., CredentialVersion = 1)
// - Add a case statement for the new version to ToCredential.
// - Modify the existing ToCredential implementation to accommodate changes to Credential.
//
// Key components include:
// - Credential: The main structure representing a single credential.
// - CredentialRecord: A structure for storing credential data along with its version for future compatibility.
// - CredentialsService (interface): A service that provides methods for managing credentials.
//   - keyringCredentialsService: The service using the system's native keyring.
//   - fileCredentialsService: Fallback service for persising credentials in file when keyring is not available.
//
// Author: Posit Software, PBC
// Copyright (C) 2024 by Posit Software, PBC.
package credentials

import (
	"encoding/json"

	"github.com/google/uuid"

	"github.com/posit-dev/publisher/internal/server_type"
	"github.com/posit-dev/publisher/internal/types"
	"github.com/posit-dev/publisher/internal/util"

	"github.com/posit-dev/publisher/internal/logging"
)

const ServiceName = "Posit Publisher Safe Storage"

const CurrentVersion = 3

type Credential struct {
	GUID       string                 `json:"guid"`
	Name       string                 `json:"name"`
	ServerType server_type.ServerType `json:"serverType"`
	URL        string                 `json:"url"`

	// Connect fields
	ApiKey string `json:"apiKey"`

	// Snowflake fields
	SnowflakeConnection string `json:"snowflakeConnection"`

	// Connect Cloud fields
	AccountID        string                 `json:"accountId"`
	AccountName      string                 `json:"accountName"`
	RefreshToken     string                 `json:"refreshToken"`
	AccessToken      string                 `json:"accessToken"`
	CloudEnvironment types.CloudEnvironment `json:"cloudEnvironment"`

	// Token authentication fields
	Token      string `json:"token"`
	PrivateKey string `json:"privateKey"`
}

type CredentialV3 = Credential
type CredentialV2 struct {
	GUID       string                 `json:"guid"`
	Name       string                 `json:"name"`
	ServerType server_type.ServerType `json:"serverType"`
	URL        string                 `json:"url"`

	// Connect fields
	ApiKey string `json:"apiKey"`

	// Snowflake fields
	SnowflakeConnection string `json:"snowflakeConnection"`

	// Connect Cloud fields
	AccountID        string                 `json:"accountId"`
	AccountName      string                 `json:"accountName"`
	RefreshToken     string                 `json:"refreshToken"`
	AccessToken      string                 `json:"accessToken"`
	CloudEnvironment types.CloudEnvironment `json:"cloudEnvironment"`
}

type CredentialV1 struct {
	GUID                string `json:"guid"`
	Name                string `json:"name"`
	URL                 string `json:"url"`
	ApiKey              string `json:"apiKey"`
	SnowflakeConnection string `json:"snowflakeConnection"`
}
type CredentialV0 struct {
	GUID   string `json:"guid"`
	Name   string `json:"name"`
	URL    string `json:"url"`
	ApiKey string `json:"apiKey"`
}

func (c *Credential) ConflictCheck(newCred Credential) error {
	if newCred.ServerType.IsCloud() {
		// this is a Connect Cloud credential
		if c.ServerType.IsCloud() && c.AccountID == newCred.AccountID && c.CloudEnvironment == newCred.CloudEnvironment {
			// Connect Cloud credentials must have unique AccountID and CloudEnvironment combinations.
			return NewIdentityCollisionError(c.Name, c.URL, c.AccountName)
		}
	} else {
		// this is a Connect or Snowflake credential
		if c.ServerType.IsConnectLike() && c.URL == newCred.URL {
			// Connect/Snowflake credentials have unique URLs.
			return NewIdentityCollisionError(c.Name, c.URL, c.AccountName)
		}
	}
	if newCred.Name == c.Name {
		return NewNameCollisionError(c.Name, c.URL)
	}
	return nil
}

type CredentialRecord struct {
	GUID    string          `json:"guid"`
	Version uint            `json:"version"`
	Data    json.RawMessage `json:"data"`
}

type CredentialTable = map[string]CredentialRecord

var UseKeychain bool = true

func (cr *CredentialV0) toV1() *CredentialV1 {
	return &CredentialV1{
		GUID:                cr.GUID,
		Name:                cr.Name,
		URL:                 cr.URL,
		ApiKey:              cr.ApiKey,
		SnowflakeConnection: "",
	}
}

func (cr *CredentialV1) toV2() (*CredentialV2, error) {
	serverType, err := server_type.ServerTypeFromURL(cr.URL)
	if err != nil {
		return nil, NewCorruptedError(cr.GUID)
	}
	return &CredentialV2{
		GUID:                cr.GUID,
		ServerType:          serverType,
		Name:                cr.Name,
		URL:                 cr.URL,
		ApiKey:              cr.ApiKey,
		SnowflakeConnection: cr.SnowflakeConnection,
		AccountID:           "",
		RefreshToken:        "",
		AccessToken:         "",
		CloudEnvironment:    "",
	}, nil
}

func (cr *CredentialV2) toV3() (*CredentialV3, error) {
	return &CredentialV3{
		GUID:                cr.GUID,
		ServerType:          cr.ServerType,
		Name:                cr.Name,
		URL:                 cr.URL,
		ApiKey:              cr.ApiKey,
		SnowflakeConnection: cr.SnowflakeConnection,
		AccountID:           cr.AccountID,
		AccountName:         cr.AccountName,
		RefreshToken:        cr.RefreshToken,
		AccessToken:         cr.AccessToken,
		Token:               "",
		PrivateKey:          "",
	}, nil
}

// ToCredential converts a CredentialRecord to a Credential based on its version.
func (cr *CredentialRecord) ToCredential() (*Credential, error) {
	switch cr.Version {
	case 0:
		var cred CredentialV0
		if err := json.Unmarshal(cr.Data, &cred); err != nil {
			return nil, NewCorruptedError(cr.GUID)
		}
		v2Cred, err := cred.toV1().toV2()
		if err != nil {
			return nil, NewCorruptedError(cr.GUID)
		}
		convertedCred, err := v2Cred.toV3()
		if err != nil {
			return nil, NewCorruptedError(cr.GUID)
		}
		return convertedCred, nil
	case 1:
		var cred CredentialV1
		if err := json.Unmarshal(cr.Data, &cred); err != nil {
			return nil, NewCorruptedError(cr.GUID)
		}
		v2Cred, err := cred.toV2()
		if err != nil {
			return nil, NewCorruptedError(cr.GUID)
		}
		convertedCred, err := v2Cred.toV3()
		if err != nil {
			return nil, NewCorruptedError(cr.GUID)
		}
		return convertedCred, nil
	case 2:
		var cred CredentialV2
		if err := json.Unmarshal(cr.Data, &cred); err != nil {
			return nil, NewCorruptedError(cr.GUID)
		}
		convertedCred, err := cred.toV3()
		if err != nil {
			return nil, NewCorruptedError(cr.GUID)
		}
		return convertedCred, nil
	case 3:
		var cred CredentialV3
		if err := json.Unmarshal(cr.Data, &cred); err != nil {
			return nil, NewCorruptedError(cr.GUID)
		}
		return &cred, nil
	default:
		return nil, NewVersionError(cr.Version)
	}
}

type CreateCredentialDetails struct {
	Name       string
	URL        string
	ServerType server_type.ServerType

	// Connect fields
	ApiKey string

	// Snowflake fields
	SnowflakeConnection string

	// Connect Cloud fields
	AccountID        string
	AccountName      string
	RefreshToken     string
	AccessToken      string
	CloudEnvironment types.CloudEnvironment

	// Token authentication fields
	Token      string
	PrivateKey string
}

func (details CreateCredentialDetails) ToCredential() (*Credential, error) {
	connectPresent := details.ApiKey != ""
	snowflakePresent := details.SnowflakeConnection != ""
	connectCloudPresent := details.AccountID != "" && details.AccountName != "" && details.RefreshToken != "" && details.AccessToken != ""
	tokenAuthPresent := details.Token != "" && details.PrivateKey != ""

	switch details.ServerType {
	case server_type.ServerTypeConnect:
		// Connect can use either API key or token auth, but not both
		if (connectPresent && tokenAuthPresent) ||
			(!connectPresent && !tokenAuthPresent) ||
			snowflakePresent ||
			connectCloudPresent {
			return nil, NewIncompleteCredentialError()
		}
	case server_type.ServerTypeSnowflake:
		if !snowflakePresent || connectPresent || connectCloudPresent || tokenAuthPresent {
			return nil, NewIncompleteCredentialError()
		}
	case server_type.ServerTypeConnectCloud:
		if !connectCloudPresent || connectPresent || snowflakePresent || tokenAuthPresent {
			return nil, NewIncompleteCredentialError()
		}
	default:
		return nil, NewIncompleteCredentialError()
	}

	if details.Name == "" ||
		details.URL == "" {
		return nil, NewIncompleteCredentialError()
	}

	normalizedUrl, err := util.NormalizeServerURL(details.URL)
	if err != nil {
		return nil, err
	}

	guid := uuid.New().String()
	return &Credential{
		GUID:                guid,
		Name:                details.Name,
		ServerType:          details.ServerType,
		URL:                 normalizedUrl,
		ApiKey:              details.ApiKey,
		SnowflakeConnection: details.SnowflakeConnection,
		AccountID:           details.AccountID,
		AccountName:         details.AccountName,
		RefreshToken:        details.RefreshToken,
		AccessToken:         details.AccessToken,
		CloudEnvironment:    details.CloudEnvironment,
		Token:               details.Token,
		PrivateKey:          details.PrivateKey,
	}, nil
}

type CredServiceFactory = func(log logging.Logger) (CredentialsService, error)

type CredentialsService interface {
	Delete(guid string) error
	Get(guid string) (*Credential, error)
	List() ([]Credential, error)
	Set(details CreateCredentialDetails) (*Credential, error)
	Reset() (string, error)
}

// The main credentials service constructor that determines if the system's keyring is available to be used,
// if not, returns a file based credentials service.
func NewCredentialsService(log logging.Logger) (CredentialsService, error) {
	var fcService *fileCredentialsService = nil

	if UseKeychain {
		krService := NewKeyringCredentialsService(log)
		if krService.IsSupported() {
			log.Debug("Using keychain for credential storage.")
			return krService, nil
		}
		log.Debug("Fallback to file managed credentials service due to unavailable system keyring.")
	} else {
		log.Debug("Configuration has disabled keychain credentials. Using file managed credentials instead.")
	}

	fcService, err := NewFileCredentialsService(log)
	if err != nil {
		return fcService, err
	}

	return fcService, nil
}
