package connect_cloud

// Copyright (C) 2025 by Posit Software, PBC.

type APIClient interface {
	GetCurrentUser() (*UserResponse, error)
	CreateContent(request *CreateContentRequest) (*ContentResponse, error)
	UpdateContent(request *UpdateContentRequest) (*ContentResponse, error)
	GetAuthorization(request *AuthorizationRequest) (*AuthorizationResponse, error)
	GetRevision(revisionID string) (*Revision, error)
}
