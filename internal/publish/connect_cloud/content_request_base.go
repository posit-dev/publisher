package connect_cloud

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"fmt"
	"maps"

	"github.com/posit-dev/publisher/internal/clients/types"
	"github.com/posit-dev/publisher/internal/config"
)

func (c *ServerPublisher) hasPermissionForPrivateContent() (bool, error) {
	account, err := c.client.GetAccount(c.Account.CloudAccountID)
	if err != nil {
		return false, fmt.Errorf("failed to check account permissions for creating private content: %w", err)
	}
	return account.License.Entitlements.AccountPrivateContentFlag.Enabled, nil
}

func (c *ServerPublisher) getAccess(isFirstDeploy bool) (types.ContentAccess, error) {
	cloudCfg := c.Config.ConnectCloud

	var publicAccess bool
	var orgAccess config.OrganizationAccessType
	if isFirstDeploy {
		if cloudCfg == nil || cloudCfg.AccessControl == nil || cloudCfg.AccessControl.PublicAccess == nil {
			// If the config doesn't specify whether public access is enabled, we need to determine if the account
			// is entitled to private access. If they are, we default to private access.
			hasPermissionForPrivateContent, err := c.hasPermissionForPrivateContent()
			if err != nil {
				return "", err
			}
			publicAccess = !hasPermissionForPrivateContent
		} else {
			publicAccess = *cloudCfg.AccessControl.PublicAccess
		}
		if cloudCfg != nil && cloudCfg.AccessControl != nil {
			orgAccess = cloudCfg.AccessControl.OrganizationAccess
		}
	} else {
		// redeploy
		if cloudCfg != nil {
			if cloudCfg.AccessControl != nil {
				accessControl := cloudCfg.AccessControl
				// if neither is set, default to the server setting
				if accessControl.PublicAccess == nil && accessControl.OrganizationAccess == "" {
					return "", nil
				}
				if accessControl.PublicAccess != nil && accessControl.OrganizationAccess != "" {
					// if both are set, use them
					publicAccess = *accessControl.PublicAccess
					orgAccess = accessControl.OrganizationAccess
				} else {
					// fetch the content
					content, err := c.client.GetContent(c.Target.ID)
					if err != nil {
						return "", fmt.Errorf("failed to fetch content access settings: %w", err)
					}

					if accessControl.PublicAccess != nil {
						// if only PublicAccess is set, use it and determine org access based on the server setting
						publicAccess = *accessControl.PublicAccess
						switch content.Access {
						case types.ViewPrivateEditPrivate, types.ViewPublicEditPrivate:
							orgAccess = config.OrganizationAccessTypeDisabled
						case types.ViewTeamEditPrivate, types.ViewPublicEditTeam:
							orgAccess = config.OrganizationAccessTypeViewer
						case types.ViewTeamEditTeam:
							orgAccess = config.OrganizationAccessTypeEditor
						}
					} else {
						// if only OrganizationAccess is set, use it and determine public access based on the server setting
						orgAccess = accessControl.OrganizationAccess
						switch content.Access {
						case types.ViewPrivateEditPrivate, types.ViewTeamEditPrivate, types.ViewTeamEditTeam:
							publicAccess = false
						case types.ViewPublicEditPrivate, types.ViewPublicEditTeam:
							publicAccess = true
						}
					}
				}
			} else {
				// if AccessControl isn't present, default to the server setting
				return "", nil
			}
		} else {
			return "", nil
		}
	}

	var access types.ContentAccess
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
	return access, nil
}

func (c *ServerPublisher) getContentRequestBase(isFirstDeploy bool) (*types.ContentRequestBase, error) {
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

	cloudContentType, err := types.CloudContentTypeFromPublisherType(c.Config.Type)
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

	access, err := c.getAccess(isFirstDeploy)
	if err != nil {
		return nil, err
	}

	var connectOptions *types.ConnectOptions
	if c.Config.Connect != nil && c.Config.Connect.Runtime != nil {
		runtime := c.Config.Connect.Runtime
		connectOptions = &types.ConnectOptions{
			ConnTimeout:     runtime.ConnectionTimeout,
			ReadTimeout:     runtime.ReadTimeout,
			InitTimeout:     runtime.InitTimeout,
			IdleTimeout:     runtime.IdleTimeout,
			SchedMaxProc:    runtime.MaxProcesses,
			SchedMinProc:    runtime.MinProcesses,
			SchedMaxConns:   runtime.MaxConnsPerProcess,
			SchedLoadFactor: runtime.LoadFactor,
		}
	}

	revision := types.RequestRevision{
		SourceType:     "bundle",
		RVersion:       rVersion,
		PythonVersion:  pythonVersion,
		ContentType:    cloudContentType,
		AppMode:        appMode,
		PrimaryFile:    c.Config.Entrypoint,
		ConnectOptions: connectOptions,
	}
	base := &types.ContentRequestBase{
		Title:       title,
		Description: c.Config.Description,
		Access:      access,
		AppMode:     types.AppModeFromType(c.Config.Type),
		Secrets:     secrets,
	}
	if isFirstDeploy {
		base.NextRevision = &revision
	} else {
		base.RevisionOverrides = &revision
	}

	if cloudCfg != nil && cloudCfg.VanityName != "" {
		base.VanityName = cloudCfg.VanityName
	}

	return base, nil
}
