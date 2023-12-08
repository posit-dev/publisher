package deployment

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"io"
	"strings"

	"github.com/pelletier/go-toml/v2"
	"github.com/rstudio/connect-client/internal/accounts"
	"github.com/rstudio/connect-client/internal/config"
	"github.com/rstudio/connect-client/internal/schema"
	"github.com/rstudio/connect-client/internal/types"
	"github.com/rstudio/connect-client/internal/util"
)

type Deployment struct {
	Schema        string              `toml:"$schema" json:"$schema"`
	ServerType    accounts.ServerType `toml:"server-type" json:"serverType"`
	ServerURL     string              `toml:"server-url" json:"serverUrl"`
	Id            types.ContentID     `toml:"id" json:"id"`
	ConfigName    string              `toml:"configuration-name" json:"configurationName"`
	Configuration config.Config       `toml:"configuration" json:"configuration"`
	Files         []string            `toml:"files" json:"files"`
	DeployedAt    string              `toml:"deployed-at" json:"deployedAt"`
	SaveName      string              `toml:"-" json:"saveName"`
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

func GetDeploymentPath(base util.Path, name string) util.Path {
	return GetDeploymentsPath(base).Join(name + ".toml")
}

func ListDeploymentFiles(base util.Path) ([]util.Path, error) {
	dir := GetDeploymentsPath(base)
	return dir.Glob("*.toml")
}

func SaveNameFromPath(path util.Path) string {
	return strings.TrimSuffix(path.Base(), ".toml")
}

func RenameDeployment(base util.Path, oldName, newName string) error {
	err := util.ValidateFilename(newName)
	if err != nil {
		return err
	}
	oldPath := GetDeploymentPath(base, oldName)
	newPath := GetDeploymentPath(base, newName)
	return oldPath.Rename(newPath)
}

func FromFile(path util.Path) (*Deployment, error) {
	err := ValidateFile(path)
	if err != nil {
		return nil, err
	}
	d := New()
	err = util.ReadTOMLFile(path, d)
	if err != nil {
		return nil, err
	}
	d.SaveName = SaveNameFromPath(path)
	return d, nil
}

func ValidateFile(path util.Path) error {
	validator, err := schema.NewValidator(schema.DeploymentSchemaURL)
	if err != nil {
		return err
	}
	return validator.ValidateTOMLFile(path)
}

func (d *Deployment) Write(w io.Writer) error {
	enc := toml.NewEncoder(w)
	return enc.Encode(d)
}

func (d *Deployment) WriteFile(path util.Path) error {
	err := path.Dir().MkdirAll(0777)
	if err != nil {
		return err
	}
	f, err := path.Create()
	if err != nil {
		return err
	}
	defer f.Close()
	err = d.Write(f)
	if err != nil {
		return err
	}
	d.SaveName = SaveNameFromPath(path)
	return nil
}
