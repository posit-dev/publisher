package connect_cloud

// Copyright (C) 2025 by Posit Software, PBC.

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/suite"

	"github.com/posit-dev/publisher/internal/accounts"
	"github.com/posit-dev/publisher/internal/clients/connect_cloud"
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
	publicAccess := true
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
		ConnectCloud: &config.ConnectCloud{
			VanityName: "test-vanity-name",
			AccessControl: &config.ConnectCloudAccessControl{
				PublicAccess:       &publicAccess,
				OrganizationAccess: config.OrganizationAccessTypeViewer,
			},
		},
		Environment: map[string]string{
			"ENV_VAR_1": "env_value_1",
			"ENV_VAR_2": "env_value_2",
		},
	}
	s.publisher.SaveName = "test-save-name"
	s.publisher.Secrets = map[string]string{
		"SECRET_1": "secret_value_1",
		"SECRET_2": "secret_value_2",
	}

	// Call getContentRequestBase
	base, err := s.publisher.getContentRequestBase()

	// Verify no error is returned
	s.NoError(err)
	s.NotNil(base)

	// Verify all fields are set correctly
	s.Equal("Test Content Title", base.Title)
	s.Equal("Test content description", base.Description)
	s.Equal(clienttypes.ViewPublicEditPrivate, base.Access)
	s.Equal(clienttypes.PythonDashMode, base.AppMode)
	s.Equal("test-vanity-name", base.VanityName)

	// Verify NextRevision fields
	s.Equal("bundle", base.NextRevision.SourceType)
	s.Equal("4.3.0", base.NextRevision.RVersion)
	s.Equal("3.10.0", base.NextRevision.PythonVersion)
	s.Equal(clienttypes.ContentTypeDash, base.NextRevision.ContentType)
	s.Equal(clienttypes.PythonDashMode, base.NextRevision.AppMode)
	s.Equal("app.py", base.NextRevision.PrimaryFile)

	// Verify Secrets includes both environment variables and secrets
	s.Len(base.Secrets, 4) // 2 environment variables + 2 secrets
	secretMap := make(map[string]string)
	for _, secret := range base.Secrets {
		secretMap[secret.Name] = secret.Value
	}
	s.Equal("env_value_1", secretMap["ENV_VAR_1"])
	s.Equal("env_value_2", secretMap["ENV_VAR_2"])
	s.Equal("secret_value_1", secretMap["SECRET_1"])
	s.Equal("secret_value_2", secretMap["SECRET_2"])
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
	s.Error(err, fmt.Sprintf("content type '%s' is not supported by Connect Cloud", s.publisher.Config.Type))
	s.Nil(base)
}

func (s *ContentRequestSuite) TestGetContentRequestBaseWithUnsetPublicAccess() {
	testCases := []struct {
		name                      string
		privateContentEntitlement bool
		expectedContentAccess     clienttypes.ContentAccess
	}{
		{
			name:                      "not entitled to private access",
			privateContentEntitlement: false,
			expectedContentAccess:     clienttypes.ViewPublicEditPrivate,
		},
		{
			name:                      "entitled to private access",
			privateContentEntitlement: true,
			expectedContentAccess:     clienttypes.ViewPrivateEditPrivate,
		},
	}
	for _, tc := range testCases {
		s.Run(tc.name, func() {
			// Setup mock client
			mockClient := connect_cloud.NewMockClient()
			s.publisher.client = mockClient

			// Setup account with CloudAccountID
			s.publisher.Account.CloudAccountID = "test-account-id"

			// Setup publisher with configuration that has no PublicAccess set (nil)
			s.publisher.Config = &config.Config{
				Title:       "Test Content Title",
				Description: "Test content description",
				Type:        config.ContentTypePythonDash,
				Entrypoint:  "app.py",
				ConnectCloud: &config.ConnectCloud{
					AccessControl: &config.ConnectCloudAccessControl{
						PublicAccess:       nil, // This is the key - PublicAccess is unset
						OrganizationAccess: config.OrganizationAccessTypeDisabled,
					},
				},
			}
			s.publisher.SaveName = "test-save-name"

			// Setup mock to return account with private content entitlement defined in test case
			mockAccount := &connect_cloud.Account{
				ID:          "test-account-id",
				Name:        "test-account",
				DisplayName: "Test Account",
				License: &connect_cloud.AccountLicense{
					Entitlements: connect_cloud.AccountEntitlements{
						AccountPrivateContentFlag: connect_cloud.AccountEntitlement{
							Enabled: tc.privateContentEntitlement,
						},
					},
				},
			}
			mockClient.On("GetAccount", "test-account-id").Return(mockAccount, nil)

			// Call getContentRequestBase
			base, err := s.publisher.getContentRequestBase()

			// Verify no error is returned
			s.NoError(err)
			s.NotNil(base)

			// Verify that access is set as expected based on entitlement
			s.Equal(tc.expectedContentAccess, base.Access)

			// Verify the mock was called
			mockClient.AssertExpectations(s.T())
		})
	}

}
