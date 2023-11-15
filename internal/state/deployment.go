package state

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"
	"fmt"
	"io/fs"
	"sort"
	"strings"

	"github.com/rstudio/connect-client/internal/accounts"
	"github.com/rstudio/connect-client/internal/apptypes"
	"github.com/rstudio/connect-client/internal/bundles"
	"github.com/rstudio/connect-client/internal/config"
	"github.com/rstudio/connect-client/internal/logging"
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
	if !strings.HasSuffix(configName, ".toml") {
		configName += ".toml"
	}
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

type OldConnectDeployment struct {
	Content ConnectContent `json:"content"`
}

type OldDeployment struct {
	LocalID            LocalDeploymentID    `json:"local_id"`            // Unique ID of this publishing operation. Only valid for this run of the agent.
	SourceDir          util.Path            `json:"source_path"`         // Absolute path to source directory being published
	Target             OldTargetID          `json:"target"`              // Identity of previous deployment
	Manifest           bundles.Manifest     `json:"manifest"`            // manifest.json content for this deployment
	Connect            OldConnectDeployment `json:"connect"`             // Connect metadata for this deployment, if target is Connect
	PythonRequirements []byte               `json:"python_requirements"` // Content of requirements.txt to include
}

func OldDeploymentFromState(s *State) *OldDeployment {
	d := OldDeploymentFromConfig(s.Dir, s.Cfg, s.Account, s.Target)
	d.LocalID = s.LocalID
	return d
}

func OldDeploymentFromConfig(path util.Path, cfg *config.Config, account *accounts.Account, target *config.Deployment) *OldDeployment {
	var contentID types.ContentID
	var files bundles.ManifestFileMap

	if target != nil {
		contentID = target.Id
		files = make(bundles.ManifestFileMap)
		for _, f := range target.Files {
			files[f] = bundles.ManifestFile{
				Checksum: "",
			}
		}
	}
	return &OldDeployment{
		SourceDir: path,
		Target: OldTargetID{
			ServerType: account.ServerType,
			ServerURL:  account.URL,
			ContentId:  contentID,
		},
		Manifest: bundles.Manifest{
			Version: 1,
			Metadata: bundles.Metadata{
				AppMode:     apptypes.AppMode(cfg.Type),
				Entrypoint:  cfg.Entrypoint,
				PrimaryRmd:  cfg.Entrypoint,
				PrimaryHtml: cfg.Entrypoint,
			},
			Python: &bundles.Python{
				Version: cfg.Python.Version,
				PackageManager: bundles.PythonPackageManager{
					Name:        cfg.Python.PackageManager,
					PackageFile: cfg.Python.PackageFile,
				},
			},
			Quarto: &bundles.Quarto{
				Version: cfg.Quarto.Version,
				Engines: cfg.Quarto.Engines,
			},
			Files: files,
		},
		Connect:            OldConnectDeployment{*ConnectContentFromConfig(cfg)},
		PythonRequirements: nil,
	}
}

func getDeploymentsDirectory(sourceDir util.Path) util.Path {
	return sourceDir.Join(".posit", "deployments")
}

// listDeployments returns a list of the previous
// deployments for this source directory.
func listDeployments(sourceDir util.Path, log logging.Logger) ([]*config.Deployment, error) {
	deploymentsDir := getDeploymentsDirectory(sourceDir)
	dirContents, err := deploymentsDir.ReadDir()
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			// It's OK for the directory not to exist;
			// that means there are no prior deployments.
			return nil, nil
		} else {
			return nil, err
		}
	}
	deployments := make([]*config.Deployment, 0, len(dirContents))
	for _, fileInfo := range dirContents {
		if !fileInfo.IsDir() {
			deployment, err := config.ReadDeploymentFile(deploymentsDir.Join(fileInfo.Name()))
			if err != nil {
				return nil, err
			}
			deployments = append(deployments, deployment)
		}
	}
	sort.Slice(deployments, func(i, j int) bool {
		return deployments[i].ServerURL < deployments[j].ServerURL
	})
	return deployments, nil
}

// GetMostRecentDeployment returns the contents of the metadata
// store for the most recently deployed bundle. This is
// the default metadata that will be used when redeploying.
// Returns nil if there are no prior deployments.
func GetMostRecentDeployment(sourceDir util.Path, log logging.Logger) (*config.Deployment, error) {
	deployments, err := listDeployments(sourceDir, log)
	if err != nil {
		return nil, err
	}
	if len(deployments) == 0 {
		return nil, nil
	}
	return deployments[0], nil
}
