package deployment

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"fmt"
	"io"

	"github.com/pelletier/go-toml/v2"
	"github.com/rstudio/connect-client/internal/accounts"
	"github.com/rstudio/connect-client/internal/config"
	"github.com/rstudio/connect-client/internal/types"
	"github.com/rstudio/connect-client/internal/util"
)

type Deployment struct {
	Schema        config.SchemaURL    `toml:"$schema" json:"$schema"`
	ServerType    accounts.ServerType `toml:"server-type" json:"server-type"`
	ServerURL     string              `toml:"server-url" json:"server-url"`
	Id            types.ContentID     `toml:"id" json:"id"`
	ConfigName    string              `toml:"configuration-name" json:"configuration-name"`
	Configuration config.Config       `toml:"configuration" json:"configuration"`
	Files         []string            `toml:"files" json:"files"`
}

const DeploymentSchema config.SchemaURL = "https://github.com/rstudio/publishing-client/blob/main/schemas/posit-publishing-record-schema-v3.json"

func New() *Deployment {
	return &Deployment{
		Schema:        DeploymentSchema,
		Configuration: *config.New(),
		Files:         []string{},
	}
}

const latestDeploymentName = "latest.toml"

func GetDeploymentsPath(base util.Path) util.Path {
	return base.Join(".posit", "publish", "deployments")
}

func GetLatestDeploymentPath(base util.Path, id string) util.Path {
	return GetDeploymentsPath(base).Join(id, latestDeploymentName)
}

func ListLatestDeploymentFiles(base util.Path) ([]util.Path, error) {
	dir := GetDeploymentsPath(base)
	return dir.Glob("*/" + latestDeploymentName)
}

func GetDeploymentHistoryPath(base util.Path, id string) (util.Path, error) {
	for i := 1; ; i++ {
		name := fmt.Sprintf("v%d.toml", i)
		path := GetDeploymentsPath(base).Join(id, name)
		exists, err := path.Exists()
		if err != nil {
			return util.Path{}, err
		}
		if !exists {
			return path, nil
		}
	}
}

func FromFile(path util.Path) (*Deployment, error) {
	deployment := New()
	err := util.ReadTOMLFile(path, deployment)
	if err != nil {
		return nil, err
	}
	return deployment, nil
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
