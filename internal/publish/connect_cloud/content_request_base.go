package connect_cloud

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"fmt"
	"maps"

	"github.com/posit-dev/publisher/internal/clients/types"
	"github.com/posit-dev/publisher/internal/config"
)

func getCloudContentType(contentType config.ContentType) (types.ContentType, error) {
	switch contentType {
	case config.ContentTypeJupyterNotebook:
		return types.ContentTypeJupyter, nil
	case config.ContentTypePythonBokeh:
		return types.ContentTypeBokeh, nil
	case config.ContentTypePythonDash:
		return types.ContentTypeDash, nil
	case config.ContentTypePythonShiny, config.ContentTypeRShiny:
		return types.ContentTypeShiny, nil
	case config.ContentTypePythonStreamlit:
		return types.ContentTypeStreamlit, nil
	case config.ContentTypeQuartoDeprecated, config.ContentTypeQuarto, config.ContentTypeHTML:
		return types.ContentTypeQuarto, nil
	case config.ContentTypeRMarkdown:
		return types.ContentTypeRMarkdown, nil
	}
	return "", fmt.Errorf("content type '%s' is not supported by Connect Cloud", contentType)
}

func (c *ServerPublisher) hasPermissionForPrivateContent() (bool, error) {
	account, err := c.client.GetAccount(c.Account.CloudAccountID)
	if err != nil {
		return false, err
	}
	return account.License.Entitlements.AccountPrivateContentFlag.Enabled, nil
}

func (c *ServerPublisher) getContentRequestBase() (*types.ContentRequestBase, error) {
	// Extract config details for the request
	title := c.Config.Title
	if title == "" {
		title = c.SaveName
	}

	rVersion := ""
	if c.Config.R != nil {
		rVersion = c.Config.R.Version
	}
	pythonVersion := ""
	if c.Config.Python != nil {
		pythonVersion = c.Config.Python.Version
	}

	cloudContentType, err := getCloudContentType(c.Config.Type)
	if err != nil {
		return nil, err
	}

	appMode := types.AppModeFromType(c.Config.Type)

	combinedEnv := make(map[string]string)
	maps.Copy(combinedEnv, c.Config.Environment)
	maps.Copy(combinedEnv, c.Secrets)
	secrets := make([]types.Secret, 0, len(c.Secrets))
	for k, v := range combinedEnv {
		secrets = append(secrets, types.Secret{
			Name:  k,
			Value: v,
		})
	}

	cloudCfg := c.Config.ConnectCloud

	var publicAccess bool
	if cloudCfg == nil || cloudCfg.AccessControl != nil && cloudCfg.AccessControl.PublicAccess == nil {
		// if the config doesn't specify whether public access is enabled, we need to determine if the account
		// is entitled to private access. If they are, we default to private access.
		hasPermissionForPrivateContent, err := c.hasPermissionForPrivateContent()
		if err != nil {
			return nil, fmt.Errorf("failed to check account permissions for creating private content: %w", err)
		}
		publicAccess = !hasPermissionForPrivateContent
	} else {
		publicAccess = *cloudCfg.AccessControl.PublicAccess
	}

	orgAccess := config.OrganizationAccessTypeDisabled
	if cloudCfg != nil && cloudCfg.AccessControl != nil {
		orgAccess = cloudCfg.AccessControl.OrganizationAccess
	}

	access := types.ViewPrivateEditPrivate
	switch orgAccess {
	case config.OrganizationAccessTypeViewer:
		if publicAccess {
			access = types.ViewPublicEditPrivate
		} else {
			access = types.ViewTeamEditPrivate
		}
	case config.OrganizationAccessTypeEditor:
		if publicAccess {
			access = types.ViewPublicEditTeam
		} else {
			access = types.ViewTeamEditTeam
		}
	default:
		// config.OrganizationAccessTypeDisabled or unset
		if publicAccess {
			if orgAccess == config.OrganizationAccessTypeDisabled {
				c.log.Warn("Organization access is not set, but public access is enabled - organization will have view access.")
			}
			access = types.ViewPublicEditPrivate
		} else {
			access = types.ViewPrivateEditPrivate
		}
	}

	vanityName := ""
	if cloudCfg != nil {
		vanityName = cloudCfg.VanityName
	}

	return &types.ContentRequestBase{
		Title:       title,
		Description: c.Config.Description,
		NextRevision: types.NextRevision{
			SourceType:    "bundle",
			RVersion:      rVersion,
			PythonVersion: pythonVersion,
			ContentType:   cloudContentType,
			AppMode:       appMode,
			PrimaryFile:   c.Config.Entrypoint,
		},
		Access:     access,
		AppMode:    types.AppModeFromType(c.Config.Type),
		Secrets:    secrets,
		VanityName: vanityName,
	}, nil
}
