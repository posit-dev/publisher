package state

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"
	"fmt"
	"io/fs"
	"sort"

	"github.com/rstudio/connect-client/internal/accounts"
	"github.com/rstudio/connect-client/internal/config"
	"github.com/rstudio/connect-client/internal/deployment"
	"github.com/rstudio/connect-client/internal/util"
)

type State struct {
	Dir         util.Path
	AccountName string
	ConfigName  string
	TargetName  string
	SaveName    string
	Account     *accounts.Account
	Config      *config.Config
	Target      *deployment.Deployment
	LocalID     LocalDeploymentID
}

func loadConfig(path util.Path, configName string) (*config.Config, error) {
	configPath := config.GetConfigPath(path, configName)
	cfg, err := config.FromFile(configPath)
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			return nil, fmt.Errorf("can't find configuration at '%s': %w", configPath, err)
		}
		return nil, err
	}
	return cfg, nil
}

func loadTarget(path util.Path, targetName string) (*deployment.Deployment, error) {
	configPath := deployment.GetDeploymentPath(path, targetName)
	target, err := deployment.FromFile(configPath)
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			return nil, fmt.Errorf("can't find deployment at '%s': %w", configPath, err)
		}
		return nil, err
	}
	return target, nil
}

// getDefaultAccount returns the name of the default account,
// which is the first Connect account alphabetically by name.
func getDefaultAccount(accounts []accounts.Account) *accounts.Account {
	if len(accounts) == 0 {
		return nil
	}
	sort.Slice(accounts, func(i, j int) bool {
		return accounts[i].Name < accounts[j].Name
	})
	return &accounts[0]
}

func loadAccount(accountName string, accountList accounts.AccountList) (*accounts.Account, error) {
	if accountName == "" {
		accounts, err := accountList.GetAllAccounts()
		if err != nil {
			return nil, err
		}
		return getDefaultAccount(accounts), nil
	} else {
		account, err := accountList.GetAccountByName(accountName)
		if err != nil {
			return nil, err
		}
		return account, nil
	}
}

func Empty() *State {
	return &State{
		Account: &accounts.Account{},
		Config:  &config.Config{},
	}
}

func New(path util.Path, accountName, configName, targetName string, saveName string, accountList accounts.AccountList) (*State, error) {
	var target *deployment.Deployment
	var account *accounts.Account
	var cfg *config.Config
	var err error

	if targetName != "" {
		target, err = loadTarget(path, targetName)
		if err != nil {
			return nil, err
		}
		// Target specifies the configuration and account names,
		// unless the caller overrides.
		if configName == "" {
			configName = target.ConfigName
		}
		if accountName == "" {
			account, err = accountList.GetAccountByServerURL(target.ServerURL)
			if err != nil {
				return nil, err
			}
			accountName = account.Name
		}
		if saveName != "" {
			target.SaveName = saveName
		} else {
			target.SaveName = targetName
		}
	} else {
		if configName == "" {
			configName = config.DefaultConfigName
		}
	}

	// Use specified account, or default account
	account, err = loadAccount(accountName, accountList)
	if err != nil {
		return nil, err
	}

	cfg, err = loadConfig(path, configName)
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			// TODO: automatically run `init` when there is no configuration file
			return nil, fmt.Errorf("couldn't load configuration '%s' from '%s'; run 'publish init' to create an initial configuration file", configName, path)
		} else {
			return nil, err
		}
	}
	return &State{
		Dir:         path,
		AccountName: accountName,
		ConfigName:  configName,
		TargetName:  targetName,
		SaveName:    saveName,
		Account:     account,
		Config:      cfg,
		Target:      target,
	}, nil
}

type LocalDeploymentID string

func NewLocalID() (LocalDeploymentID, error) {
	str, err := util.RandomString(16)
	if err != nil {
		return LocalDeploymentID(""), err
	}
	return LocalDeploymentID(str), nil
}
