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

	access := types.ViewPrivateEditPrivate
	vanityName := ""
	if cloudCfg != nil {
		if cloudCfg.AccessControl != nil {
			orgAccess := cloudCfg.AccessControl.OrganizationAccess
			publicAccess := true
			if cloudCfg.AccessControl.PublicAccess != nil {
				publicAccess = *cloudCfg.AccessControl.PublicAccess
			} else {
				accountPrivateContentEntitlement := false
				if accountPrivateContentEntitlement {
					publicAccess = false
				} else {
					publicAccess = true
				}
			}
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
		}

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
