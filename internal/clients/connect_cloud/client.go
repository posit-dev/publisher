package connect_cloud

import (
	"github.com/posit-dev/publisher/internal/clients/types"
	internaltypes "github.com/posit-dev/publisher/internal/types"
)

// Copyright (C) 2025 by Posit Software, PBC.

type APIClient interface {
	GetCurrentUser() (*UserResponse, error)
	GetAccounts() (*AccountListResponse, error)
	GetAccount(accountID string) (*Account, error)
	GetContent(contentID internaltypes.ContentID) (*types.ContentResponse, error)
	CreateContent(request *types.CreateContentRequest) (*types.ContentResponse, error)
	UpdateContent(request *types.UpdateContentRequest) (*types.ContentResponse, error)
	GetAuthorization(request *types.AuthorizationRequest) (*types.AuthorizationResponse, error)
	GetRevision(revisionID string) (*types.Revision, error)
	PublishContent(contentID string) error
}
