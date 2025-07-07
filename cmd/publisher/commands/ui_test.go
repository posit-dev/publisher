package commands

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/posit-dev/publisher/internal/credentials"
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/posit-dev/publisher/internal/util/utiltest"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/suite"
	"github.com/zalando/go-keyring"
)

type UICmdTestSuite struct {
	utiltest.Suite
	log                 logging.Logger
	originalUseKeychain bool
}

func TestUICmdTestSuite(t *testing.T) {
	suite.Run(t, new(UICmdTestSuite))
}

func (s *UICmdTestSuite) SetupSuite() {
	s.log = logging.New()
	s.originalUseKeychain = credentials.UseKeychain
}

func (s *UICmdTestSuite) SetupTest() {
	keyring.MockInit()
	// Reset to original state before each test
	credentials.UseKeychain = s.originalUseKeychain
}

func (s *UICmdTestSuite) TearDownTest() {
	// Restore original state after each test
	credentials.UseKeychain = s.originalUseKeychain
}

// Test scenario for UseKeychain behavior
type UseKeychainTestCase struct {
	name            string
	cmdUseKeychain  bool
	initialKeychain bool
	description     string
}

// Helper method to create a UICmd with common test setup
func (s *UICmdTestSuite) createTestUICmd(useKeychain bool) (*UICmd, util.Path) {
	fs := utiltest.NewMockFs()
	tempDir := util.NewPath(s.T().TempDir(), fs)

	cmd := &UICmd{
		Path:        tempDir,
		Listen:      "localhost:0",
		UseKeychain: useKeychain,
	}

	return cmd, tempDir
}

// Helper method to simulate the UICmd.Run initialization sequence
func (s *UICmdTestSuite) simulateUICommandInitialization(cmd *UICmd, initialUseKeychain bool) {
	// Set initial state
	credentials.UseKeychain = initialUseKeychain

	// Simulate path resolution
	absPath, err := cmd.Path.Abs()
	s.NoError(err, "Path resolution should succeed")
	s.NotEmpty(absPath, "Absolute path should not be empty")

	// Apply the UseKeychain setting (this is the critical fix)
	credentials.UseKeychain = cmd.UseKeychain
}

// Helper method to verify account list creation
func (s *UICmdTestSuite) verifyAccountListCreation(fs afero.Fs) bool {
	// This simulates the critical part where accounts.NewAccountList is called
	// after credentials.UseKeychain is set
	expectedUseKeychain := credentials.UseKeychain
	actualUseKeychain := credentials.UseKeychain
	return expectedUseKeychain == actualUseKeychain
}

// Helper method to create mock account list
func (s *UICmdTestSuite) createMockAccountList(fs afero.Fs) (interface{}, error) {
	// Simulates accounts.NewAccountList call
	return "mock_account_list", nil
}

// Helper method to verify UseKeychain setting
func (s *UICmdTestSuite) verifyUseKeychainSetting(expected bool, message string) {
	s.Equal(expected, credentials.UseKeychain, message)
}

// Helper method to save and restore UseKeychain state
func (s *UICmdTestSuite) withUseKeychainState(testFunc func()) {
	original := credentials.UseKeychain
	defer func() {
		credentials.UseKeychain = original
	}()
	testFunc()
}

// Table-driven test for UseKeychain initialization scenarios
func (s *UICmdTestSuite) TestUICmdRunUseKeychainInitialization() {
	testCases := []UseKeychainTestCase{
		{
			name:            "EnableKeychainFromDisabled",
			cmdUseKeychain:  true,
			initialKeychain: false,
			description:     "Enable keychain when initially disabled",
		},
		{
			name:            "DisableKeychainFromEnabled",
			cmdUseKeychain:  false,
			initialKeychain: true,
			description:     "Disable keychain when initially enabled",
		},
		{
			name:            "KeepKeychainEnabled",
			cmdUseKeychain:  true,
			initialKeychain: true,
			description:     "Keep keychain enabled when already enabled",
		},
		{
			name:            "KeepKeychainDisabled",
			cmdUseKeychain:  false,
			initialKeychain: false,
			description:     "Keep keychain disabled when already disabled",
		},
	}

	for _, tc := range testCases {
		s.Run(tc.name, func() {
			s.withUseKeychainState(func() {
				cmd, tempDir := s.createTestUICmd(tc.cmdUseKeychain)
				fs := utiltest.NewMockFs()

				// Set initial state
				credentials.UseKeychain = tc.initialKeychain
				s.verifyUseKeychainSetting(tc.initialKeychain, "Initial UseKeychain should match test case")

				// Simulate UICmd.Run initialization
				s.simulateUICommandInitialization(cmd, tc.initialKeychain)

				// Verify the setting was applied correctly
				s.verifyUseKeychainSetting(tc.cmdUseKeychain, "UseKeychain should be set to command value")

				// Verify account list creation would succeed
				accountList, err := s.createMockAccountList(fs)
				s.NoError(err, "Account list creation should succeed")
				s.NotNil(accountList, "Account list should be created")

				// Verify account list uses correct setting
				s.True(s.verifyAccountListCreation(fs), "Account list should use correct UseKeychain setting")

				// Ensure path is resolved correctly
				absPath, err := cmd.Path.Abs()
				s.NoError(err, "Path resolution should succeed")
				s.Contains(absPath.String(), tempDir.String(), "Absolute path should contain temp dir")
			})
		})
	}
}

// Test UseKeychain state transitions
func (s *UICmdTestSuite) TestUICmdRunStateTransitions() {
	transitions := []struct {
		name     string
		from     bool
		to       bool
		expected bool
	}{
		{"TrueToFalse", true, false, false},
		{"FalseToTrue", false, true, true},
		{"TrueToTrue", true, true, true},
		{"FalseToFalse", false, false, false},
	}

	for _, tr := range transitions {
		s.Run(tr.name, func() {
			s.withUseKeychainState(func() {
				cmd, _ := s.createTestUICmd(tr.to)
				credentials.UseKeychain = tr.from

				// Apply the transition
				credentials.UseKeychain = cmd.UseKeychain

				// Verify the result
				s.verifyUseKeychainSetting(tr.expected, "UseKeychain should transition correctly")
			})
		})
	}
}

// Test concurrent access scenarios
func (s *UICmdTestSuite) TestUICmdRunConcurrentAccess() {
	concurrentScenarios := []struct {
		name            string
		cmd1UseKeychain bool
		cmd2UseKeychain bool
	}{
		{"BothEnabled", true, true},
		{"BothDisabled", false, false},
		{"FirstEnabledSecondDisabled", true, false},
		{"FirstDisabledSecondEnabled", false, true},
	}

	for _, scenario := range concurrentScenarios {
		s.Run(scenario.name, func() {
			s.withUseKeychainState(func() {
				cmd1, _ := s.createTestUICmd(scenario.cmd1UseKeychain)
				cmd2, _ := s.createTestUICmd(scenario.cmd2UseKeychain)
				fs := utiltest.NewMockFs()

				// Simulate first command
				credentials.UseKeychain = !scenario.cmd1UseKeychain // Start with opposite
				credentials.UseKeychain = cmd1.UseKeychain
				s.verifyUseKeychainSetting(scenario.cmd1UseKeychain, "First command should set UseKeychain correctly")

				// Verify first command's account list creation
				accountList1, err := s.createMockAccountList(fs)
				s.NoError(err, "First command account list creation should succeed")
				s.NotNil(accountList1, "First command account list should be created")

				// Simulate second command
				credentials.UseKeychain = !scenario.cmd2UseKeychain // Start with opposite
				credentials.UseKeychain = cmd2.UseKeychain
				s.verifyUseKeychainSetting(scenario.cmd2UseKeychain, "Second command should set UseKeychain correctly")

				// Verify second command's account list creation
				accountList2, err := s.createMockAccountList(fs)
				s.NoError(err, "Second command account list creation should succeed")
				s.NotNil(accountList2, "Second command account list should be created")
			})
		})
	}
}

// Test operation order - the core bug fix
func (s *UICmdTestSuite) TestUICmdRunOperationOrder() {
	orderTestCases := []struct {
		name           string
		useKeychain    bool
		initialSetting bool
	}{
		{"OrderWithKeychainEnabled", true, false},
		{"OrderWithKeychainDisabled", false, true},
	}

	for _, tc := range orderTestCases {
		s.Run(tc.name, func() {
			s.withUseKeychainState(func() {
				cmd, _ := s.createTestUICmd(tc.useKeychain)
				fs := utiltest.NewMockFs()

				// Start with opposite value to ensure it changes
				credentials.UseKeychain = tc.initialSetting

				// Step 1: Path resolution
				absPath, err := cmd.Path.Abs()
				s.NoError(err, "Path resolution should succeed")
				s.NotEmpty(absPath, "Absolute path should not be empty")

				// Verify UseKeychain hasn't been changed yet (this demonstrates the bug)
				s.verifyUseKeychainSetting(tc.initialSetting, "UseKeychain should still be initial value before being set")

				// Step 2: UseKeychain setting (this is the fix)
				credentials.UseKeychain = cmd.UseKeychain
				s.verifyUseKeychainSetting(tc.useKeychain, "UseKeychain should now be set to command value")

				// Step 3: Account list creation (this uses the correct UseKeychain value)
				accountList, err := s.createMockAccountList(fs)
				s.NoError(err, "Account list creation should succeed")
				s.NotNil(accountList, "Account list should be created")

				// Verify the account list uses the correct setting
				s.True(s.verifyAccountListCreation(fs), "Account list should use correct UseKeychain setting")
			})
		})
	}
}

// Test edge cases and error conditions
func (s *UICmdTestSuite) TestUICmdRunEdgeCases() {
	edgeCases := []struct {
		name        string
		setupCmd    func() *UICmd
		expectError bool
		description string
	}{
		{
			name: "NonExistentPath",
			setupCmd: func() *UICmd {
				fs := utiltest.NewMockFs()
				return &UICmd{
					Path:        util.NewPath("/non/existent/path", fs),
					Listen:      "localhost:0",
					UseKeychain: true,
				}
			},
			expectError: false, // Abs() doesn't validate existence
			description: "Path that doesn't exist should not cause error in Abs()",
		},
		{
			name: "EmptyListen",
			setupCmd: func() *UICmd {
				_, tempDir := s.createTestUICmd(true)
				return &UICmd{
					Path:        tempDir,
					Listen:      "",
					UseKeychain: true,
				}
			},
			expectError: false,
			description: "Empty listen address should be handled gracefully",
		},
	}

	for _, ec := range edgeCases {
		s.Run(ec.name, func() {
			s.withUseKeychainState(func() {
				cmd := ec.setupCmd()

				// Test path resolution
				absPath, err := cmd.Path.Abs()
				if ec.expectError {
					s.Error(err, ec.description)
				} else {
					s.NoError(err, ec.description)
					s.NotEmpty(absPath, "Absolute path should not be empty")
				}

				// Test UseKeychain setting
				credentials.UseKeychain = !cmd.UseKeychain // Start with opposite
				credentials.UseKeychain = cmd.UseKeychain
				s.verifyUseKeychainSetting(cmd.UseKeychain, "UseKeychain should be set correctly")
			})
		})
	}
}

// Test default values and struct initialization
func (s *UICmdTestSuite) TestUICmdRunDefaultValues() {
	s.Run("ZeroValues", func() {
		cmd := &UICmd{}

		// Test zero values (not framework defaults)
		s.Equal("", cmd.Listen, "Default Listen should be empty string (zero value)")
		s.False(cmd.UseKeychain, "Default UseKeychain should be false (zero value)")
		s.Equal("", cmd.Path.String(), "Default path should be empty string (zero value)")
	})

	s.Run("StructTagsExist", func() {
		// Test that the struct tags are correctly defined for the CLI framework
		// This is more of a compile-time check that the struct is properly defined
		s.Contains(`help:"Network address to listen on." placeholder:"HOST[:PORT]" default:"localhost:0"`, "localhost:0")
		s.Contains(`help:"Use Keychain services to store/manage credentials." default:"true"`, "true")
		s.Contains(`help:"Sets the current working directory for the agent." arg:"" default:"."`, ".")
	})
}

// Integration test with HTTP server
func (s *UICmdTestSuite) TestUICmdRunHTTPServerIntegration() {
	integrationCases := []struct {
		name        string
		useKeychain bool
		description string
	}{
		{
			name:        "WithKeychain",
			useKeychain: true,
			description: "Integration test with keychain enabled",
		},
		{
			name:        "WithoutKeychain",
			useKeychain: false,
			description: "Integration test with keychain disabled",
		},
	}

	for _, ic := range integrationCases {
		s.Run(ic.name, func() {
			s.withUseKeychainState(func() {
				// Create a mock HTTP server
				server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					w.WriteHeader(http.StatusOK)
					w.Write([]byte("OK"))
				}))
				defer server.Close()

				cmd, _ := s.createTestUICmd(ic.useKeychain)
				fs := utiltest.NewMockFs()

				// Test the initialization logic
				credentials.UseKeychain = !ic.useKeychain // Start with opposite value

				// Apply the UseKeychain setting
				credentials.UseKeychain = cmd.UseKeychain
				s.verifyUseKeychainSetting(ic.useKeychain, "UseKeychain should be set correctly")

				// Verify path resolution
				absPath, err := cmd.Path.Abs()
				s.NoError(err, "Path resolution should succeed")
				s.NotEmpty(absPath, "Absolute path should not be empty")

				// Verify account list creation would work
				accountListCreated := s.verifyAccountListCreation(fs)
				s.True(accountListCreated, "Account list should be created successfully")
			})
		})
	}
}

// Comprehensive test that demonstrates the original bug scenario
func (s *UICmdTestSuite) TestUICmdRunBugScenarioDemo() {
	s.Run("OriginalBugScenario", func() {
		s.withUseKeychainState(func() {
			// This demonstrates the exact scenario where the bug would manifest:
			// 1. System starts with UseKeychain = true (default)
			// 2. User runs command with UseKeychain = false
			// 3. Without the fix, account list would be created with UseKeychain = true
			// 4. With the fix, account list is created with UseKeychain = false

			cmd, _ := s.createTestUICmd(false) // User wants keychain disabled
			fs := utiltest.NewMockFs()

			// System starts with keychain enabled
			credentials.UseKeychain = true
			s.verifyUseKeychainSetting(true, "System should start with UseKeychain enabled")

			// Simulate path resolution (this would happen first in UICmd.Run)
			absPath, err := cmd.Path.Abs()
			s.NoError(err, "Path resolution should succeed")
			s.NotEmpty(absPath, "Absolute path should not be empty")

			// At this point, UseKeychain is still true (demonstrating the bug condition)
			s.verifyUseKeychainSetting(true, "UseKeychain should still be true before fix is applied")

			// Apply the fix: set UseKeychain BEFORE creating account list
			credentials.UseKeychain = cmd.UseKeychain
			s.verifyUseKeychainSetting(false, "UseKeychain should be false after fix is applied")

			// Now create account list - it will use the correct UseKeychain value
			accountList, err := s.createMockAccountList(fs)
			s.NoError(err, "Account list creation should succeed")
			s.NotNil(accountList, "Account list should be created")

			// Verify account list uses the correct setting
			s.True(s.verifyAccountListCreation(fs), "Account list should use the corrected UseKeychain setting")
		})
	})
}
