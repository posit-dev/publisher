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
	"github.com/posit-dev/publisher/internal/contenttypes"
	"github.com/posit-dev/publisher/internal/deployment"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/publish/publishhelper"
	"github.com/posit-dev/publisher/internal/state"
	content_types "github.com/posit-dev/publisher/internal/types"
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
		Type:        contenttypes.ContentTypePythonDash,
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
	base, err := s.publisher.getContentRequestBase(true)

	// Verify no error is returned
	s.NoError(err)
	s.NotNil(base)

	// Verify all fields are set correctly
	s.Equal("Test Content Title", base.Title)
	s.Equal("Test content description", base.Description)
	s.Equal(clienttypes.ViewPublicEditPrivate, base.Access)
	s.Equal("test-vanity-name", base.VanityName)

	// Verify RequestRevision fields
	s.Equal("bundle", base.NextRevision.SourceType)
	s.Equal("3.10.0", base.NextRevision.PythonVersion)
	s.Equal(clienttypes.ContentTypeDash, base.NextRevision.ContentType)
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
	publicAccess := true
	s.publisher.Config = &config.Config{
		Description: "Test content description",
		Type:        contenttypes.ContentTypePythonDash,
		Entrypoint:  "app.py",
		ConnectCloud: &config.ConnectCloud{
			AccessControl: &config.ConnectCloudAccessControl{
				PublicAccess: &publicAccess,
			},
		},
	}
	s.publisher.SaveName = "test-save-name"

	// Call getContentRequestBase
	base, err := s.publisher.getContentRequestBase(true)

	// Verify no error is returned
	s.NoError(err)
	s.NotNil(base)

	// Verify title is set to SaveName
	s.Equal("test-save-name", base.Title)
}

func asPointer[T any](v T) *T {
	return &v
}

func (s *ContentRequestSuite) TestGetContentRequestBaseRevisionOverrides() {
	// Setup publisher with a configuration that has all fields populated
	s.publisher.Config = &config.Config{
		Title:       "Test Content Title",
		Description: "Test content description",
		Type:        contenttypes.ContentTypePythonDash,
		Entrypoint:  "app.py",
		R: &config.R{
			Version: "4.3.0",
		},
		Python: &config.Python{
			Version: "3.10.0",
		},
		Connect: &config.Connect{
			Runtime: &config.ConnectRuntime{
				ConnectionTimeout:  asPointer(int32(1)),
				ReadTimeout:        asPointer(int32(2)),
				InitTimeout:        asPointer(int32(3)),
				IdleTimeout:        asPointer(int32(4)),
				MaxProcesses:       asPointer(int32(5)),
				MinProcesses:       asPointer(int32(6)),
				MaxConnsPerProcess: asPointer(int32(7)),
				LoadFactor:         asPointer(float64(8.0)),
			},
		},
	}
	s.publisher.SaveName = "test-save-name"

	// Call getContentRequestBase with isFirstDeploy = false
	base, err := s.publisher.getContentRequestBase(false)

	// Verify no error is returned
	s.NoError(err)
	s.NotNil(base)

	// Verify NextRevision is not set
	s.Nil(base.NextRevision)

	// Verify RevisionOverrides is set correctly
	s.NotNil(base.RevisionOverrides)
	s.Equal("bundle", base.RevisionOverrides.SourceType)
	s.Equal("3.10.0", base.RevisionOverrides.PythonVersion)
	s.Equal("app.py", base.RevisionOverrides.PrimaryFile)

	s.Equal(int32(1), *base.RevisionOverrides.ConnectOptions.ConnTimeout)
	s.Equal(int32(2), *base.RevisionOverrides.ConnectOptions.ReadTimeout)
	s.Equal(int32(3), *base.RevisionOverrides.ConnectOptions.InitTimeout)
	s.Equal(int32(4), *base.RevisionOverrides.ConnectOptions.IdleTimeout)
	s.Equal(int32(5), *base.RevisionOverrides.ConnectOptions.SchedMaxProc)
	s.Equal(int32(6), *base.RevisionOverrides.ConnectOptions.SchedMinProc)
	s.Equal(int32(7), *base.RevisionOverrides.ConnectOptions.SchedMaxConns)
	s.Equal(float64(8.0), *base.RevisionOverrides.ConnectOptions.SchedLoadFactor)
}

func (s *ContentRequestSuite) TestGetContentRequestBaseUnsupportedType() {
	// Setup publisher with an unsupported content type
	s.publisher.Config = &config.Config{
		Title:       "Test Content Title",
		Description: "Test content description",
		Type:        contenttypes.ContentType("unsupported-type"),
		Entrypoint:  "app.py",
	}

	// Call getContentRequestBase
	base, err := s.publisher.getContentRequestBase(true)

	// Verify an error is returned
	s.Error(err, fmt.Sprintf("content type '%s' is not supported by Connect Cloud", s.publisher.Config.Type))
	s.Nil(base)
}

func (s *ContentRequestSuite) TestGetAccess() {
	testCases := []struct {
		name                      string
		isFirstDeploy             bool
		nilConfig                 bool
		accessControl             *config.ConnectCloudAccessControl
		privateContentEntitlement *bool
		existingContentAccess     *clienttypes.ContentAccess
		expectedAccess            clienttypes.ContentAccess
		//expectError               bool
		//errorMessage              string
	}{
		// First deploy cases with privateContentEntitlement
		{
			name:                      "first deploy - no config, not entitled to private",
			isFirstDeploy:             true,
			nilConfig:                 true,
			privateContentEntitlement: boolPtr(false),
			expectedAccess:            clienttypes.ViewPublicEditPrivate,
		},
		{
			name:                      "first deploy - no config, entitled to private",
			isFirstDeploy:             true,
			accessControl:             nil,
			nilConfig:                 true,
			privateContentEntitlement: boolPtr(true),
			expectedAccess:            clienttypes.ViewPrivateEditPrivate,
		},
		{
			name:                      "first deploy - nil access control, not entitled to private",
			isFirstDeploy:             true,
			accessControl:             nil,
			privateContentEntitlement: boolPtr(false),
			expectedAccess:            clienttypes.ViewPublicEditPrivate,
		},
		{
			name:                      "first deploy - nil access control, entitled to private",
			isFirstDeploy:             true,
			accessControl:             nil,
			privateContentEntitlement: boolPtr(true),
			expectedAccess:            clienttypes.ViewPrivateEditPrivate,
		},
		{
			name:          "first deploy - public true, org disabled",
			isFirstDeploy: true,
			accessControl: &config.ConnectCloudAccessControl{
				PublicAccess:       boolPtr(true),
				OrganizationAccess: config.OrganizationAccessTypeDisabled,
			},
			expectedAccess: clienttypes.ViewPublicEditPrivate,
		},
		{
			name:          "first deploy - public true, org viewer",
			isFirstDeploy: true,
			accessControl: &config.ConnectCloudAccessControl{
				PublicAccess:       boolPtr(true),
				OrganizationAccess: config.OrganizationAccessTypeViewer,
			},
			expectedAccess: clienttypes.ViewPublicEditPrivate,
		},
		{
			name:          "first deploy - public true, org editor",
			isFirstDeploy: true,
			accessControl: &config.ConnectCloudAccessControl{
				PublicAccess:       boolPtr(true),
				OrganizationAccess: config.OrganizationAccessTypeEditor,
			},
			expectedAccess: clienttypes.ViewPublicEditTeam,
		},
		{
			name:          "first deploy - public false, org disabled",
			isFirstDeploy: true,
			accessControl: &config.ConnectCloudAccessControl{
				PublicAccess:       boolPtr(false),
				OrganizationAccess: config.OrganizationAccessTypeDisabled,
			},
			expectedAccess: clienttypes.ViewPrivateEditPrivate,
		},
		{
			name:          "first deploy - public false, org viewer",
			isFirstDeploy: true,
			accessControl: &config.ConnectCloudAccessControl{
				PublicAccess:       boolPtr(false),
				OrganizationAccess: config.OrganizationAccessTypeViewer,
			},
			expectedAccess: clienttypes.ViewTeamEditPrivate,
		},
		{
			name:          "first deploy - public false, org editor",
			isFirstDeploy: true,
			accessControl: &config.ConnectCloudAccessControl{
				PublicAccess:       boolPtr(false),
				OrganizationAccess: config.OrganizationAccessTypeEditor,
			},
			expectedAccess: clienttypes.ViewTeamEditTeam,
		},

		// Subsequent deploy cases - both access control settings provided
		{
			name:          "subsequent deploy - public false, org disabled",
			isFirstDeploy: false,
			accessControl: &config.ConnectCloudAccessControl{
				PublicAccess:       boolPtr(false),
				OrganizationAccess: config.OrganizationAccessTypeDisabled,
			},
			expectedAccess: clienttypes.ViewPrivateEditPrivate,
		},
		{
			name:          "subsequent deploy - public false, org viewer",
			isFirstDeploy: false,
			accessControl: &config.ConnectCloudAccessControl{
				PublicAccess:       boolPtr(false),
				OrganizationAccess: config.OrganizationAccessTypeViewer,
			},
			expectedAccess: clienttypes.ViewTeamEditPrivate,
		},
		{
			name:          "subsequent deploy - public false, org editor",
			isFirstDeploy: false,
			accessControl: &config.ConnectCloudAccessControl{
				PublicAccess:       boolPtr(false),
				OrganizationAccess: config.OrganizationAccessTypeEditor,
			},
			expectedAccess: clienttypes.ViewTeamEditTeam,
		},
		{
			name:          "subsequent deploy - public true, org disabled",
			isFirstDeploy: false,
			accessControl: &config.ConnectCloudAccessControl{
				PublicAccess:       boolPtr(true),
				OrganizationAccess: config.OrganizationAccessTypeDisabled,
			},
			expectedAccess: clienttypes.ViewPublicEditPrivate,
		},
		{
			name:          "subsequent deploy - public true, org viewer",
			isFirstDeploy: false,
			accessControl: &config.ConnectCloudAccessControl{
				PublicAccess:       boolPtr(true),
				OrganizationAccess: config.OrganizationAccessTypeViewer,
			},
			expectedAccess: clienttypes.ViewPublicEditPrivate,
		},
		{
			name:          "subsequent deploy - public true, org editor",
			isFirstDeploy: false,
			accessControl: &config.ConnectCloudAccessControl{
				PublicAccess:       boolPtr(true),
				OrganizationAccess: config.OrganizationAccessTypeEditor,
			},
			expectedAccess: clienttypes.ViewPublicEditTeam,
		},

		// Subsequent deploy cases - only PublicAccess provided
		{
			name:          "subsequent deploy - only public true, existing ViewTeamEditPrivate",
			isFirstDeploy: false,
			accessControl: &config.ConnectCloudAccessControl{
				PublicAccess: boolPtr(true),
			},
			existingContentAccess: contentAccessPtr(clienttypes.ViewTeamEditPrivate),
			expectedAccess:        clienttypes.ViewPublicEditPrivate,
		},
		{
			name:          "subsequent deploy - only public false, existing ViewPublicEditTeam",
			isFirstDeploy: false,
			accessControl: &config.ConnectCloudAccessControl{
				PublicAccess: boolPtr(false),
			},
			existingContentAccess: contentAccessPtr(clienttypes.ViewPublicEditTeam),
			expectedAccess:        clienttypes.ViewTeamEditPrivate,
		},
		{
			name:          "subsequent deploy - only public true, existing ViewPrivateEditPrivate",
			isFirstDeploy: false,
			accessControl: &config.ConnectCloudAccessControl{
				PublicAccess: boolPtr(true),
			},
			existingContentAccess: contentAccessPtr(clienttypes.ViewPrivateEditPrivate),
			expectedAccess:        clienttypes.ViewPublicEditPrivate,
		},
		{
			name:          "subsequent deploy - only public false, existing ViewPublicEditPrivate",
			isFirstDeploy: false,
			accessControl: &config.ConnectCloudAccessControl{
				PublicAccess: boolPtr(false),
			},
			existingContentAccess: contentAccessPtr(clienttypes.ViewPublicEditPrivate),
			expectedAccess:        clienttypes.ViewPrivateEditPrivate,
		},
		{
			name:          "subsequent deploy - only public true, existing ViewTeamEditTeam",
			isFirstDeploy: false,
			accessControl: &config.ConnectCloudAccessControl{
				PublicAccess: boolPtr(true),
			},
			existingContentAccess: contentAccessPtr(clienttypes.ViewTeamEditTeam),
			expectedAccess:        clienttypes.ViewPublicEditTeam,
		},
		{
			name:          "subsequent deploy - only public false, existing ViewTeamEditTeam",
			isFirstDeploy: false,
			accessControl: &config.ConnectCloudAccessControl{
				PublicAccess: boolPtr(false),
			},
			existingContentAccess: contentAccessPtr(clienttypes.ViewTeamEditTeam),
			expectedAccess:        clienttypes.ViewTeamEditTeam,
		},
		// Subsequent deploy cases - only OrganizationAccess provided
		{
			name:          "subsequent deploy - only org editor, existing ViewPublicEditPrivate",
			isFirstDeploy: false,
			accessControl: &config.ConnectCloudAccessControl{
				OrganizationAccess: config.OrganizationAccessTypeDisabled,
			},
			existingContentAccess: contentAccessPtr(clienttypes.ViewPublicEditPrivate),
			expectedAccess:        clienttypes.ViewPublicEditPrivate,
		},
		{
			name:          "subsequent deploy - only org viewer, existing ViewPrivateEditPrivate",
			isFirstDeploy: false,
			accessControl: &config.ConnectCloudAccessControl{
				OrganizationAccess: config.OrganizationAccessTypeViewer,
			},
			existingContentAccess: contentAccessPtr(clienttypes.ViewPrivateEditPrivate),
			expectedAccess:        clienttypes.ViewTeamEditPrivate,
		},
		{
			name:          "subsequent deploy - only org editor, existing ViewPublicEditPrivate",
			isFirstDeploy: false,
			accessControl: &config.ConnectCloudAccessControl{
				OrganizationAccess: config.OrganizationAccessTypeEditor,
			},
			existingContentAccess: contentAccessPtr(clienttypes.ViewPublicEditPrivate),
			expectedAccess:        clienttypes.ViewPublicEditTeam,
		},
		// Subsequent deploy cases - no access control settings
		{
			name:           "subsequent deploy - no access control (nil config)",
			isFirstDeploy:  false,
			nilConfig:      true,
			expectedAccess: "",
		},
	}

	for _, tc := range testCases {
		s.Run(tc.name, func() {
			// Setup mock client
			mockClient := connect_cloud.NewMockClient()
			s.publisher.client = mockClient

			// Setup account with CloudAccountID
			s.publisher.Account.CloudAccountID = "test-account-id"
			s.publisher.Target = &deployment.Deployment{ID: "test-content-id"}

			// Setup configuration
			connectCloudConfig := &config.ConnectCloud{
				AccessControl: tc.accessControl,
			}

			s.publisher.Config = &config.Config{
				ConnectCloud: connectCloudConfig,
			}

			if tc.nilConfig {
				s.publisher.Config.ConnectCloud = nil
			}

			// Setup mock expectations
			if tc.isFirstDeploy && (tc.accessControl == nil || tc.accessControl.PublicAccess == nil) && tc.privateContentEntitlement != nil {
				// Mock GetAccount call for private content entitlement check
				mockAccount := &connect_cloud.Account{
					ID:          "test-account-id",
					Name:        "test-account",
					DisplayName: "Test Account",
					License: &connect_cloud.AccountLicense{
						Entitlements: connect_cloud.AccountEntitlements{
							AccountPrivateContentFlag: connect_cloud.AccountEntitlement{
								Enabled: *tc.privateContentEntitlement,
							},
						},
					},
				}
				mockClient.On("GetAccount", "test-account-id").Return(mockAccount, nil)
			}

			if !tc.isFirstDeploy && tc.existingContentAccess != nil {
				// Mock GetContent call for existing content access
				mockContent := &clienttypes.ContentResponse{
					ID:     content_types.ContentID("test-content-id"),
					Access: *tc.existingContentAccess,
				}
				mockClient.On("GetContent", content_types.ContentID("test-content-id")).Return(mockContent, nil)
			}

			// Call getAccess
			access, err := s.publisher.getAccess(tc.isFirstDeploy)
			s.NoError(err)
			s.Equal(tc.expectedAccess, access)

			// Verify mock expectations were met
			mockClient.AssertExpectations(s.T())
		})
	}
}

// Helper functions for test cases
func boolPtr(b bool) *bool {
	return &b
}

func contentAccessPtr(access clienttypes.ContentAccess) *clienttypes.ContentAccess {
	return &access
}
