package connect_cloud

import "github.com/posit-dev/publisher/internal/clients/types"

// Copyright (C) 2025 by Posit Software, PBC.

type APIClient interface {
	GetCurrentUser() (*UserResponse, error)
	CreateUser() error
	GetAccounts() (*AccountListResponse, error)
	CreateContent(request *types.CreateContentRequest) (*types.ContentResponse, error)
	UpdateContent(request *types.UpdateContentRequest) (*types.ContentResponse, error)
	GetAuthorization(request *types.AuthorizationRequest) (*types.AuthorizationResponse, error)
	GetRevision(revisionID string) (*types.Revision, error)
}
