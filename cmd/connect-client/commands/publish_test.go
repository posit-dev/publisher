package commands

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/rstudio/connect-client/internal/accounts"
	"github.com/rstudio/connect-client/internal/cli_types"
	"github.com/rstudio/connect-client/internal/logging"
	"github.com/rstudio/connect-client/internal/state"
	"github.com/rstudio/connect-client/internal/types"
	"github.com/rstudio/connect-client/internal/util"
	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/suite"
)

type PublishCommandSuite struct {
	utiltest.Suite
}

func TestPublishCommandSuite(t *testing.T) {
	suite.Run(t, new(PublishCommandSuite))
}

func (s *PublishCommandSuite) createSavedState(path util.Path, accountName, configName string) {
	// This fixture simulates executing a publish command,
	// which will create a saved state directory.
	deployment := state.NewDeployment()
	deployment.Target.AccountName = accountName

	cmd := &PublishCmd{
		BaseBundleCmd: &BaseBundleCmd{
			PublishArgs: cli_types.PublishArgs{
				Path:   path,
				State:  deployment,
				Config: configName,
				New:    false,
			},
		},
	}
	ctx := &cli_types.CLIContext{
		Accounts: nil,
		Fs:       path.Fs(),
		Logger:   logging.New(),
	}
	// There isn't state to load, but LoadState also sets up
	// parameters such as SourceDir.
	err := cmd.LoadState(ctx)
	s.NoError(err)

	cmd.State.Target.DeployedAt = types.NewOptional(time.Now())

	err = cmd.SaveState(ctx)
	s.NoError(err)
}

func (s *PublishCommandSuite) assertStateExists(path util.Path, name string) {
	// The state should exist, be decodable as JSON, and
	// contain the expected account name.
	idPath := path.Join(".posit", "deployments", "test", "id.json")
	exists, err := idPath.Exists()
	s.NoError(err)
	s.True(exists)

	target := state.TargetID{}
	f, err := idPath.Open()
	s.NoError(err)
	defer f.Close()
	decoder := json.NewDecoder(f)
	decoder.DisallowUnknownFields()
	decoder.Decode(&target)
	s.Equal("test", target.AccountName)
}

func (s *PublishCommandSuite) TestSaveState() {
	afs := afero.NewMemMapFs()
	path := util.NewPath("/", afs)
	s.createSavedState(path, "test", "")
	s.assertStateExists(path, "test")
}

func (s *PublishCommandSuite) TestLoadStateDefaultAccountNoPriorDeployments() {
	deployment := state.NewDeployment()
	afs := afero.NewMemMapFs()
	path := util.NewPath("/", afs)

	cmd := &PublishCmd{
		BaseBundleCmd: &BaseBundleCmd{
			PublishArgs: cli_types.PublishArgs{
				Path:   path,
				State:  deployment,
				Config: "",
				New:    false,
			},
		},
	}

	lister := accounts.NewMockAccountList()
	lister.On("GetAccountsByServerType", accounts.ServerTypeConnect).Return([]accounts.Account{{
		Name: "test",
	}}, nil)

	ctx := &cli_types.CLIContext{
		Accounts: lister,
		Fs:       afs,
		Logger:   logging.New(),
	}
	err := cmd.LoadState(ctx)
	s.NoError(err)
	s.Equal("test", cmd.State.Target.AccountName)
}

func (s *PublishCommandSuite) TestLoadStateWithAccountNoPriorDeployments() {
	// Account name is provided on the CLI, but there are no prior deployments.
	deployment := state.NewDeployment()
	deployment.Target.AccountName = "test"
	afs := afero.NewMemMapFs()
	path := util.NewPath("/", afs)

	cmd := &PublishCmd{
		BaseBundleCmd: &BaseBundleCmd{
			PublishArgs: cli_types.PublishArgs{
				Path:   path,
				State:  deployment,
				Config: "",
				New:    false,
			},
		},
	}

	ctx := &cli_types.CLIContext{
		Accounts: nil,
		Fs:       afs,
		Logger:   logging.New(),
	}
	err := cmd.LoadState(ctx)
	s.NoError(err)
	s.Equal("test", cmd.State.Target.AccountName)
}

func (s *PublishCommandSuite) TestLoadStateWithAccountAndPriorDeployments() {
	// Account name is provided on the CLI, and there are prior deployments.
	// The provided account name should be used.
	afs := afero.NewMemMapFs()
	path := util.NewPath("/", afs)
	s.createSavedState(path, "not-it", "")

	deployment := state.NewDeployment()
	deployment.Target.AccountName = "test"

	cmd := &PublishCmd{
		BaseBundleCmd: &BaseBundleCmd{
			PublishArgs: cli_types.PublishArgs{
				Path:   path,
				State:  deployment,
				Config: "",
				New:    false,
			},
		},
	}

	ctx := &cli_types.CLIContext{
		Accounts: nil,
		Fs:       afs,
		Logger:   logging.New(),
	}
	err := cmd.LoadState(ctx)
	s.NoError(err)
	s.Equal("test", cmd.State.Target.AccountName)
}

func (s *PublishCommandSuite) TestLoadStateNoAccountAndPriorDeployments() {
	// No account name was specified on the CLI, but there are
	// prior deployments. Use the most recent one.
	afs := afero.NewMemMapFs()
	path := util.NewPath("/", afs)
	s.createSavedState(path, "older", "")
	s.createSavedState(path, "newer", "")

	deployment := state.NewDeployment()

	cmd := &PublishCmd{
		BaseBundleCmd: &BaseBundleCmd{
			PublishArgs: cli_types.PublishArgs{
				Path:   path,
				State:  deployment,
				Config: "",
				New:    false,
			},
		},
	}

	ctx := &cli_types.CLIContext{
		Accounts: nil,
		Fs:       afs,
		Logger:   logging.New(),
	}
	err := cmd.LoadState(ctx)
	s.NoError(err)
	s.Equal("newer", cmd.State.Target.AccountName)
}

func (s *PublishCommandSuite) TestGetDefaultAccountEmpty() {
	s.Equal("", getDefaultAccount([]accounts.Account{}))
}

func (s *PublishCommandSuite) TestGetDefaultAccountOne() {
	s.Equal("abc", getDefaultAccount([]accounts.Account{
		{Name: "abc"},
	}))
}

func (s *PublishCommandSuite) TestGetDefaultAccountMultiple() {
	s.Equal("abc", getDefaultAccount([]accounts.Account{
		{Name: "def"},
		{Name: "abc"},
	}))
}
