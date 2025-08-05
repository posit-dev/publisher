package connect_cloud

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"fmt"

	"github.com/posit-dev/publisher/internal/clients/types"
	"github.com/posit-dev/publisher/internal/config"
)

func getCloudContentType(contentType config.ContentType) (types.ContentType, error) {
	switch contentType {
	case config.ContentTypeHTML, config.ContentTypeJupyterNotebook, config.ContentTypeJupyterVoila:
		return types.ContentTypeJupyter, nil
	case config.ContentTypePythonBokeh:
		return types.ContentTypeBokeh, nil
	case config.ContentTypePythonDash:
		return types.ContentTypeDash, nil
	case config.ContentTypePythonShiny, config.ContentTypeRShiny, config.ContentTypeQuartoShiny, config.ContentTypeRMarkdownShiny:
		return types.ContentTypeShiny, nil
	case config.ContentTypePythonStreamlit:
		return types.ContentTypeStreamlit, nil
	case config.ContentTypePythonGradio:
	case config.ContentTypeQuartoDeprecated, config.ContentTypeQuarto:
		return types.ContentTypeQuarto, nil
	case config.ContentTypeRMarkdown:
		return types.ContentTypeRMarkdown, nil
	}
	return "", fmt.Errorf("unsupported content type: %s", contentType)
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
		Access:  types.ViewPrivateEditPrivate,
		AppMode: types.AppModeFromType(c.Config.Type),
	}, nil
}
