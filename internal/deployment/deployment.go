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
	Schema        config.SchemaURL    `toml:"$schema"`
	ServerType    accounts.ServerType `toml:"server-type"`
	ServerURL     string              `toml:"server-url"`
	Id            types.ContentID     `toml:"id"`
	ConfigName    string              `toml:"configuration-name"`
	Configuration config.Config       `toml:"configuration"`
	Files         []string            `toml:"files"`
}

const DeploymentSchema config.SchemaURL = "https://github.com/rstudio/publishing-client/blob/main/schemas/posit-publishing-record-schema-v3.json"

func New() *Deployment {
	return &Deployment{
		Schema:        DeploymentSchema,
		Configuration: *config.New(),
	}
}

const latestDeploymentName = "latest.toml"

func GetLatestDeploymentPath(base util.Path, id string) util.Path {
	return base.Join(".posit", "deployments", id, latestDeploymentName)
}

func GetDeploymentHistoryPath(base util.Path, id string) (util.Path, error) {
	for i := 1; ; i++ {
		name := fmt.Sprintf("v%d.toml", i)
		path := base.Join(".posit", "deployments", id, name)
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
