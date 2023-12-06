package deployment

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"io"

	"github.com/pelletier/go-toml/v2"
	"github.com/rstudio/connect-client/internal/accounts"
	"github.com/rstudio/connect-client/internal/config"
	"github.com/rstudio/connect-client/internal/schema"
	"github.com/rstudio/connect-client/internal/types"
	"github.com/rstudio/connect-client/internal/util"
)

type Deployment struct {
	Schema        string              `toml:"$schema" json:"$schema"`
	ServerType    accounts.ServerType `toml:"server-type" json:"server-type"`
	ServerURL     string              `toml:"server-url" json:"server-url"`
	Id            types.ContentID     `toml:"id" json:"id"`
	ConfigName    string              `toml:"configuration-name" json:"configuration-name"`
	Configuration config.Config       `toml:"configuration" json:"configuration"`
	Files         []string            `toml:"files" json:"files"`
	DeployedAt    string              `toml:"deployed-at" json:"deployed-at"`
}

func New() *Deployment {
	return &Deployment{
		Schema:        schema.DeploymentSchemaURL,
		ServerType:    accounts.ServerTypeConnect,
		Configuration: *config.New(),
		Files:         []string{},
	}
}

func GetDeploymentsPath(base util.Path) util.Path {
	return base.Join(".posit", "publish", "deployments")
}

func GetDeploymentPath(base util.Path, id string) util.Path {
	return GetDeploymentsPath(base).Join(id + ".toml")
}

func ListDeploymentFiles(base util.Path) ([]util.Path, error) {
	dir := GetDeploymentsPath(base)
	return dir.Glob("*.toml")
}

func FromFile(path util.Path) (*Deployment, error) {
	err := ValidateFile(path)
	if err != nil {
		return nil, err
	}
	deployment := New()
	err = util.ReadTOMLFile(path, deployment)
	if err != nil {
		return nil, err
	}
	return deployment, nil
}

func ValidateFile(path util.Path) error {
	validator, err := schema.NewValidator(schema.DeploymentSchemaURL)
	if err != nil {
		return err
	}
	return validator.ValidateTOMLFile(path)
}

func (record *Deployment) Write(w io.Writer) error {
	enc := toml.NewEncoder(w)
	return enc.Encode(record)
}

func (record *Deployment) WriteFile(path util.Path) error {
	err := path.Dir().MkdirAll(0777)
	if err != nil {
		return err
	}
	f, err := path.Create()
	if err != nil {
		return err
	}
	defer f.Close()
	return record.Write(f)
}
