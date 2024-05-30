package state

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"
	"fmt"
	"io/fs"

	"github.com/rstudio/connect-client/internal/accounts"
	"github.com/rstudio/connect-client/internal/config"
	"github.com/rstudio/connect-client/internal/deployment"
	"github.com/rstudio/connect-client/internal/util"
)

type State struct {
	Dir         util.AbsolutePath
	AccountName string
	ConfigName  string
	TargetName  string
	SaveName    string
	Account     *accounts.Account
	Config      *config.Config
	Target      *deployment.Deployment
	LocalID     LocalDeploymentID
}

func loadConfig(path util.AbsolutePath, configName string) (*config.Config, error) {
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

func loadTarget(path util.AbsolutePath, targetName string) (*deployment.Deployment, error) {
	deploymentPath := deployment.GetDeploymentPath(path, targetName)
	target, err := deployment.FromFile(deploymentPath)
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			return nil, fmt.Errorf("can't find deployment at '%s': %w", deploymentPath, err)
		}
		return nil, err
	}
	return target, nil
}

var errNoAccounts = errors.New("there are no accounts yet; register an account before publishing")
var errMultipleAccounts = errors.New("there are multiple accounts; please specify which one to use with the -a option")

// getDefaultAccount returns the name of the default account,
// which is the first Connect account alphabetically by name.
func getDefaultAccount(accountList []accounts.Account) (*accounts.Account, error) {
	if len(accountList) == 0 {
		return nil, errNoAccounts
	} else if len(accountList) > 1 {
		// If an account was provided via environment variables, use it.
		for _, acct := range accountList {
			if acct.Source == accounts.AccountSourceEnvironment {
				return &acct, nil
			}
		}
		// Otherwise we don't have a way to choose
		return nil, errMultipleAccounts
	}
	return &accountList[0], nil
}

func loadAccount(accountName string, accountList accounts.AccountList) (*accounts.Account, error) {
	if accountName == "" {
		accounts, err := accountList.GetAllAccounts()
		if err != nil {
			return nil, err
		}
		return getDefaultAccount(accounts)
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

var ErrServerURLMismatch = errors.New("the account provided is for a different server; it must match the server for this deployment")

func New(path util.AbsolutePath, accountName, configName, targetName string, saveName string, accountList accounts.AccountList) (*State, error) {
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
	} else {
		target = deployment.New()
	}

	// Use specified account, or default account
	account, err = loadAccount(accountName, accountList)
	if err != nil {
		return nil, err
	}

	if target.ServerURL != "" && target.ServerURL != account.URL {
		return nil, ErrServerURLMismatch
	}

	if configName == "" {
		configName = config.DefaultConfigName
	}
	cfg, err = loadConfig(path, configName)
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
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
