package state

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"
	"fmt"
	"io/fs"
	"sort"
	"strings"

	"github.com/rstudio/connect-client/internal/accounts"
	"github.com/rstudio/connect-client/internal/config"
	"github.com/rstudio/connect-client/internal/types"
	"github.com/rstudio/connect-client/internal/util"
)

type State struct {
	Dir         util.Path
	AccountName string
	ConfigName  string
	TargetID    string
	Account     *accounts.Account
	Cfg         *config.Config
	Target      *config.Deployment
	LocalID     LocalDeploymentID
}

func loadConfig(path util.Path, configName string) (*config.Config, error) {
	configName = config.NormalizeConfigName(configName)
	configPath := path.Join(".posit", "publish", configName)
	cfg, err := config.ReadOrCreateConfigFile(configPath)
	if err != nil {
		return nil, err
	}
	return cfg, nil
}

func loadTarget(path util.Path, targetID string) (*config.Deployment, error) {
	if !strings.HasSuffix(targetID, ".toml") {
		targetID += ".toml"
	}
	configPath := path.Join(".posit", "deployments", targetID)
	target, err := config.ReadDeploymentFile(configPath)
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			return nil, fmt.Errorf("can't find deployment at '%s'", configPath)
		}
		return nil, err
	}
	return target, nil
}

// getDefaultAccount returns the name of the default account,
// which is the first Connect account alphabetically by name.
func getDefaultAccount(accounts []accounts.Account) (*accounts.Account, error) {
	if len(accounts) == 0 {
		return nil, errNoAccounts
	}
	sort.Slice(accounts, func(i, j int) bool {
		return accounts[i].Name < accounts[j].Name
	})
	return &accounts[0], nil
}

var errNoAccounts = errors.New("there are no accounts yet; register an account before publishing")

func loadAccount(accountName string, accountList accounts.AccountList) (*accounts.Account, error) {
	if accountName == "" {
		accounts, err := accountList.GetAllAccounts()
		if err != nil {
			return nil, err
		}
		account, err := getDefaultAccount(accounts)
		if err != nil {
			return nil, err
		}
		return account, nil
	} else {
		account, err := accountList.GetAccountByName(accountName)
		if err != nil {
			return nil, err
		}
		return account, nil
	}
}

var errTargetImpliesConfig = errors.New("cannot specify --config with --target")
var errTargetImpliesAccount = errors.New("cannot specify --account with --target")

func Empty() *State {
	return &State{
		Account: &accounts.Account{},
		Cfg:     &config.Config{},
	}
}

func New(path util.Path, accountName, configName, targetID string, accountList accounts.AccountList) (*State, error) {
	var target *config.Deployment
	var account *accounts.Account
	var cfg *config.Config
	var err error

	if targetID != "" {
		// Specifying an existing deployment determines
		// the account and configuration.
		// TODO: see if this can be done with a Kong group.
		if configName != "" {
			return nil, errTargetImpliesConfig
		}
		if accountName != "" {
			return nil, errTargetImpliesAccount
		}
		target, err = loadTarget(path, targetID)
		if err != nil {
			return nil, err
		}

		// Target specifies the configuration name
		configName = target.ConfigurationFile

		// and the account's server URL
		account, err = accountList.GetAccountByServerURL(target.ServerURL)
		if err != nil {
			return nil, err
		}
		accountName = account.Name
	} else {
		// Use specified account, or default account
		account, err = loadAccount(accountName, accountList)
		if err != nil {
			return nil, err
		}
	}
	cfg, err = loadConfig(path, configName)
	if err != nil {
		return nil, err
	}
	return &State{
		Dir:         path,
		AccountName: accountName,
		ConfigName:  configName,
		TargetID:    targetID,
		Account:     account,
		Cfg:         cfg,
		Target:      target,
	}, nil
}

type OldTargetID struct {
	ServerType  accounts.ServerType `json:"server_type"`                                            // Which type of API this server provides
	ServerURL   string              `json:"server_url"`                                             // Server URL
	ContentId   types.ContentID     `json:"content_id" help:"Unique ID of content item to update."` // Content ID (GUID for Connect)
	ContentName types.ContentName   `json:"content_name" help:"Name of content item to update."`    // Content Name (unique per user)

	// These fields are informational and don't affect future deployments.
	Username string             `json:"username,omitempty"` // Username, if known
	BundleId types.NullBundleID `json:"bundle_id"`          // Bundle ID that was deployed
}

type LocalDeploymentID string

func NewLocalID() (LocalDeploymentID, error) {
	str, err := util.RandomString(16)
	if err != nil {
		return LocalDeploymentID(""), err
	}
	return LocalDeploymentID(str), nil
}
