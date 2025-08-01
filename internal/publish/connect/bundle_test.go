package connect

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"bytes"
	"io"
	"testing"

	"github.com/spf13/afero"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"

	"github.com/posit-dev/publisher/internal/accounts"
	"github.com/posit-dev/publisher/internal/clients/connect"
	"github.com/posit-dev/publisher/internal/config"
	"github.com/posit-dev/publisher/internal/deployment"
	"github.com/posit-dev/publisher/internal/events"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/publish/publishhelper"
	"github.com/posit-dev/publisher/internal/state"
	"github.com/posit-dev/publisher/internal/types"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/posit-dev/publisher/internal/util/utiltest"
)

type BundleSuite struct {
	utiltest.Suite
	state    *state.State
	log      logging.Logger
	emitter  *events.CapturingEmitter
	client   *connect.MockClient
	fs       afero.Fs
	helper   *publishhelper.PublishHelper
	dir      util.AbsolutePath
	testPath util.AbsolutePath
}

func TestBundleSuite(t *testing.T) {
	suite.Run(t, new(BundleSuite))
}

func (s *BundleSuite) SetupTest() {
	s.fs = afero.NewMemMapFs()
	s.dir = util.NewAbsolutePath("/test/dir", s.fs)
	s.testPath = s.dir.Join("test_deployment.toml")
	s.dir.MkdirAll(0755)

	// Set up base objects
	s.log = logging.NewDiscardLogger()
	emitter := events.NewCapturingEmitter()
	s.emitter = emitter
	s.client = connect.NewMockClient()

	// Create state with required properties
	s.state = &state.State{
		Dir:         s.dir,
		AccountName: "test-account",
		ConfigName:  "test-config",
		TargetName:  "test-target",
		SaveName:    "test-save",
		Account: &accounts.Account{
			Name: "test-account",
			URL:  "https://connect.example.com",
		},
		Config: &config.Config{
			Title: "Test Content",
		},
		Target:  deployment.New(),
		LocalID: "test-local-id",
	}

	// Create publisher helper
	s.helper = publishhelper.NewPublishHelper(s.state, s.log)
}

func (s *BundleSuite) createServerPublisher() *ServerPublisher {
	return &ServerPublisher{
		State:   s.state,
		log:     s.log,
		emitter: s.emitter,
		client:  s.client,
		helper:  s.helper,
	}
}

func (s *BundleSuite) TestUploadBundleSuccess() {
	// Mock data
	contentID := types.ContentID("test-content-id")
	expectedBundleID := types.BundleID("test-bundle-id")
	bundleContent := []byte("test bundle content")
	bundleReader := bytes.NewReader(bundleContent)

	// Set up mock client
	s.client.On("UploadBundle",
		contentID,
		mock.MatchedBy(func(reader io.Reader) bool {
			// We don't need to verify the exact content, just that a reader was passed
			return reader != nil
		}),
		mock.Anything, // logger
	).Return(expectedBundleID, nil)

	// Create publisher
	publisher := s.createServerPublisher()

	// Call the function under test
	bundleID, err := publisher.uploadBundle(bundleReader, contentID)

	// Verify results
	s.NoError(err)
	s.Equal(expectedBundleID, bundleID)
	s.Equal(expectedBundleID, publisher.Target.BundleID)
	s.Contains(publisher.Target.BundleURL, "test-content-id")
	s.Contains(publisher.Target.BundleURL, "test-bundle-id")

	// Verify mock calls
	s.client.AssertExpectations(s.T())

	// Verify events
	s.Len(s.emitter.Events, 2)
	s.Equal("publish/uploadBundle/start", s.emitter.Events[0].Type)
	s.Equal("publish/uploadBundle/success", s.emitter.Events[1].Type)
}

func (s *BundleSuite) TestUploadBundleFailure() {
	// Mock data
	contentID := types.ContentID("test-content-id")
	bundleContent := []byte("test bundle content")
	bundleReader := bytes.NewReader(bundleContent)

	// Set up mock client to return an error
	mockError := types.NewAgentError(types.ErrorUnknown, nil, nil)
	s.client.On("UploadBundle",
		contentID,
		mock.MatchedBy(func(reader io.Reader) bool {
			return reader != nil
		}),
		mock.Anything,
	).Return(types.BundleID(""), mockError)

	// Create publisher
	publisher := s.createServerPublisher()

	// Call the function under test
	bundleID, err := publisher.uploadBundle(bundleReader, contentID)

	// Verify results
	s.Error(err)
	s.Equal(types.BundleID(""), bundleID)
	s.Equal(types.BundleID(""), publisher.Target.BundleID)
	s.Empty(publisher.Target.BundleURL)

	// Verify mock calls
	s.client.AssertExpectations(s.T())

	// Verify events
	s.Len(s.emitter.Events, 1)
	s.Equal("publish/uploadBundle/start", s.emitter.Events[0].Type)
}
