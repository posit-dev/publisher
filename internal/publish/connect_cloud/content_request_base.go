package connect_cloud

import "github.com/posit-dev/publisher/internal/clients/types"

func (c *ServerPublisher) getContentRequestBase() types.ContentRequestBase {

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

	return types.ContentRequestBase{
		Title:       title,
		Description: c.Config.Description,
		NextRevision: types.NextRevision{
			SourceType:    "bundle",
			RVersion:      rVersion,
			PythonVersion: pythonVersion,
		},
		Access:  types.ViewPrivateEditPrivate,
		AppMode: types.AppModeFromType(c.Config.Type),
	}
}
