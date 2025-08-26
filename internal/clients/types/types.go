package types

import (
	"fmt"

	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/types"
)

// Copyright (C) 2025 by Posit Software, PBC.

// UserResponse represents a response from the Connect Cloud user endpoint.
type UserResponse struct {
	AccountRoles map[string]UserAccountRole `json:"account_roles"`
}

// UserAccountRole represents a user's role in an account.
type UserAccountRole struct {
	Role    string                 `json:"role"`
	Account UserAccountRoleAccount `json:"account"`
}

// UserAccountRoleAccount represents an account in a user account role.
type UserAccountRoleAccount struct {
	Name string `json:"name"`
}

// ContentAccess represents the access control settings for a content item.
type ContentAccess string

const (
	// ViewPrivateEditPrivate means the content is only visible and editable by the owner.
	ViewPrivateEditPrivate ContentAccess = "view_private_edit_private"
	// ViewTeamEditPrivate means the content is visible to team members but only editable by the owner.
	ViewTeamEditPrivate ContentAccess = "view_team_edit_private"
	// ViewTeamEditTeam means the content is visible and editable by team members.
	ViewTeamEditTeam ContentAccess = "view_team_edit_team"
	// ViewPublicEditPrivate means the content is publicly visible but only editable by the owner.
	ViewPublicEditPrivate ContentAccess = "view_public_edit_private"
	// ViewPublicEditTeam means the content is publicly visible and editable by team members.
	ViewPublicEditTeam ContentAccess = "view_public_edit_team"
)

// ContentType represents the type of content being created.
type ContentType string

const (
	// ContentTypeBokeh represents a Bokeh application.
	ContentTypeBokeh ContentType = "bokeh"
	// ContentTypeDash represents a Dash application.
	ContentTypeDash ContentType = "dash"
	// ContentTypeJupyter represents a Jupyter notebook.
	ContentTypeJupyter ContentType = "jupyter"
	// ContentTypeQuarto represents a Quarto document.
	ContentTypeQuarto ContentType = "quarto"
	// ContentTypeShiny represents a Shiny application.
	ContentTypeShiny ContentType = "shiny"
	// ContentTypeStreamlit represents a Streamlit application.
	ContentTypeStreamlit ContentType = "streamlit"
	// ContentTypeRMarkdown represents an R Markdown document.
	ContentTypeRMarkdown ContentType = "rmarkdown"
)

func CloudContentTypeFromPublisherType(contentType config.ContentType) (ContentType, error) {
	switch contentType {
	case config.ContentTypeJupyterNotebook:
		return ContentTypeJupyter, nil
	case config.ContentTypePythonBokeh:
		return ContentTypeBokeh, nil
	case config.ContentTypePythonDash:
		return ContentTypeDash, nil
	case config.ContentTypePythonShiny, config.ContentTypeRShiny:
		return ContentTypeShiny, nil
	case config.ContentTypePythonStreamlit:
		return ContentTypeStreamlit, nil
	case config.ContentTypeQuartoDeprecated, config.ContentTypeQuarto, config.ContentTypeHTML:
		return ContentTypeQuarto, nil
	case config.ContentTypeRMarkdown:
		return ContentTypeRMarkdown, nil
	}
	return "", fmt.Errorf("content type '%s' is not supported by Connect Cloud", contentType)
}

// Secret represents a secret key-value pair.
type Secret struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}

// Revision represents a content revision.
type Revision struct {
	ID                    string                 `json:"id"`
	PublishLogChannel     string                 `json:"publish_log_channel"`
	PublishResult         PublishResult          `json:"publish_result"`
	PublishErrorCode      string                 `json:"publish_error_code,omitempty"`
	PublishErrorArgs      map[string]interface{} `json:"publish_error_args,omitempty"`
	SourceBundleID        string                 `json:"source_bundle_id"`
	SourceBundleUploadURL string                 `json:"source_bundle_upload_url"`
	PublishError          string                 `json:"publish_error,omitempty"`
	PublishErrorDetails   string                 `json:"publish_error_details,omitempty"`
}

type PublishResult string

const (
	PublishResultSuccess PublishResult = "success"
	PublishResultFailure PublishResult = "failure"
)

// RequestRevision represents the configuration for the next content revision.
type RequestRevision struct {
	SourceType    string      `json:"source_type"`
	RVersion      string      `json:"r_version,omitempty"`
	PythonVersion string      `json:"python_version,omitempty"`
	ContentType   ContentType `json:"content_type,omitempty"`
	AppMode       AppMode     `json:"app_mode,omitempty"`
	PrimaryFile   string      `json:"primary_file,omitempty"`
}

// ContentRequestBase contains common fields for content creation and update requests.
type ContentRequestBase struct {
	Title             string           `json:"title"`
	Description       string           `json:"description,omitempty"`
	NextRevision      *RequestRevision `json:"next_revision,omitempty"`
	RevisionOverrides *RequestRevision `json:"revision_overrides,omitempty"`
	Access            ContentAccess    `json:"access"`
	Secrets           []Secret         `json:"secrets,omitempty"`
	VanityName        string           `json:"vanity_name,omitempty"`
	AppMode           AppMode          `json:"app_mode"`
	ContentType       ContentType      `json:"content_type"`
}

// CreateContentRequest represents a request to create a new content item.
type CreateContentRequest struct {
	ContentRequestBase
	AccountID string `json:"account_id"`
}

// UpdateContentRequest represents a request to update an existing content item.
type UpdateContentRequest struct {
	ContentRequestBase
	ContentID types.ContentID `json:"-"` // Not sent in the request body, used for the URL
}

// ContentResponse represents a response from creating or updating a content item.
type ContentResponse struct {
	ID           types.ContentID `json:"id"`
	NextRevision *Revision       `json:"next_revision,omitempty"`
	Access       ContentAccess   `json:"access"`
}

// AuthorizationRequest represents a request to authorize access to a resource.
type AuthorizationRequest struct {
	ResourceType string `json:"resource_type"`
	ResourceID   string `json:"resource_id"`
	Permission   string `json:"permission"`
}

// AuthorizationResponse represents a response from an authorization request.
type AuthorizationResponse struct {
	Authorized bool   `json:"authorized"`
	Token      string `json:"token,omitempty"`
}
