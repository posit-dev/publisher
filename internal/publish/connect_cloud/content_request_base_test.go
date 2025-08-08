package connect_cloud

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"testing"

	"github.com/stretchr/testify/suite"

	"github.com/posit-dev/publisher/internal/accounts"
	clienttypes "github.com/posit-dev/publisher/internal/clients/types"
	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/publish/publishhelper"
	"github.com/posit-dev/publisher/internal/state"
	"github.com/posit-dev/publisher/internal/util/utiltest"
)

// ContentRequestSuite is a test suite for testing content_request_base.go
type ContentRequestSuite struct {
	utiltest.Suite
	publisher *ServerPublisher
}

func TestContentRequestSuite(t *testing.T) {
	suite.Run(t, new(ContentRequestSuite))
}

func (s *ContentRequestSuite) SetupTest() {
	// Create state with required fields
	stateObj := &state.State{
		Account: &accounts.Account{},
		Config:  config.New(),
	}

	// Create a publisher helper
	helper := publishhelper.NewPublishHelper(stateObj, logging.New())

	// Create a publisher
	s.publisher = &ServerPublisher{
		State:  stateObj,
		log:    logging.New(),
		helper: helper,
	}
}

func (s *ContentRequestSuite) TestGetContentRequestBase() {
	// Setup publisher with a configuration that has all fields populated
	s.publisher.Config = &config.Config{
		Title:       "Test Content Title",
		Description: "Test content description",
		Type:        config.ContentTypePythonDash,
		Entrypoint:  "app.py",
		R: &config.R{
			Version: "4.3.0",
		},
		Python: &config.Python{
			Version: "3.10.0",
		},
	}
	s.publisher.SaveName = "test-save-name"

	// Call getContentRequestBase
	base, err := s.publisher.getContentRequestBase()

	// Verify no error is returned
	s.NoError(err)
	s.NotNil(base)

	// Verify all fields are set correctly
	s.Equal("Test Content Title", base.Title)
	s.Equal("Test content description", base.Description)
	s.Equal(clienttypes.ViewPrivateEditPrivate, base.Access)
	s.Equal(clienttypes.PythonDashMode, base.AppMode)

	// Verify NextRevision fields
	s.Equal("bundle", base.NextRevision.SourceType)
	s.Equal("4.3.0", base.NextRevision.RVersion)
	s.Equal("3.10.0", base.NextRevision.PythonVersion)
	s.Equal(clienttypes.ContentTypeDash, base.NextRevision.ContentType)
	s.Equal(clienttypes.PythonDashMode, base.NextRevision.AppMode)
	s.Equal("app.py", base.NextRevision.PrimaryFile)
}

func (s *ContentRequestSuite) TestGetContentRequestBaseNoTitle() {
	// Setup publisher with a configuration that has no title
	s.publisher.Config = &config.Config{
		Description: "Test content description",
		Type:        config.ContentTypePythonDash,
		Entrypoint:  "app.py",
	}
	s.publisher.SaveName = "test-save-name"

	// Call getContentRequestBase
	base, err := s.publisher.getContentRequestBase()

	// Verify no error is returned
	s.NoError(err)
	s.NotNil(base)

	// Verify title is set to SaveName
	s.Equal("test-save-name", base.Title)
}

func (s *ContentRequestSuite) TestGetContentRequestBaseUnsupportedType() {
	// Setup publisher with an unsupported content type
	s.publisher.Config = &config.Config{
		Title:       "Test Content Title",
		Description: "Test content description",
		Type:        config.ContentType("unsupported-type"),
		Entrypoint:  "app.py",
	}

	// Call getContentRequestBase
	base, err := s.publisher.getContentRequestBase()

	// Verify an error is returned
	s.Error(err)
	s.Nil(base)
	s.Contains(err.Error(), "unsupported content type")
}
