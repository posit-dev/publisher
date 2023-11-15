package config

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"fmt"
	"io"

	"github.com/pelletier/go-toml/v2"
	"github.com/rstudio/connect-client/internal/util"
)

const DeploymentSchema SchemaURL = "https://github.com/rstudio/publishing-client/blob/main/schemas/posit-publishing-record-schema-v3.json"

func NewDeployment() *Deployment {
	return &Deployment{
		Schema:        DeploymentSchema,
		Configuration: *NewConfig(),
	}
}

func GetDeploymentPath(base util.Path, d *Deployment) util.Path {
	name := fmt.Sprintf("%s-%s.toml", d.ConfigName, d.Id)
	return base.Join(".posit", "deployments", name)
}

func GetDeploymentHistoryPath(base util.Path, d *Deployment) (util.Path, error) {
	for i := 1; ; i++ {
		dirname := fmt.Sprintf("%s-%s", d.ConfigName, d.Id)
		name := fmt.Sprintf("v%d.toml", i)
		path := base.Join(".posit", "history", dirname, name)
		exists, err := path.Exists()
		if err != nil {
			return util.Path{}, err
		}
		if !exists {
			return path, nil
		}
	}
}

func ReadDeployment(r io.Reader) (*Deployment, error) {
	dec := toml.NewDecoder(r)
	dec.DisallowUnknownFields()
	record := new(Deployment)
	err := dec.Decode(record)
	return record, err
}

func ReadDeploymentFile(path util.Path) (*Deployment, error) {
	f, err := path.Open()
	if err != nil {
		return nil, err
	}
	defer f.Close()
	return ReadDeployment(f)
}

func WriteDeployment(record *Deployment, w io.Writer) error {
	enc := toml.NewEncoder(w)
	return enc.Encode(record)
}

func WriteDeploymentFile(record *Deployment, path util.Path) error {
	err := path.Dir().MkdirAll(0777)
	if err != nil {
		return err
	}
	f, err := path.Create()
	if err != nil {
		return err
	}
	defer f.Close()
	return WriteDeployment(record, f)
}
