package config

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"io"
	"strings"

	"github.com/pelletier/go-toml/v2"
	"github.com/rstudio/connect-client/internal/schema"
	"github.com/rstudio/connect-client/internal/util"
)

const DefaultConfigName = "default"

func New() *Config {
	return &Config{
		Schema:     schema.ConfigSchemaURL,
		Type:       ContentTypeUnknown,
		Entrypoint: "unknown",
		Validate:   true,
	}
}

func GetConfigDir(base util.Path) util.Path {
	return base.Join(".posit", "publish")
}

func GetConfigPath(base util.Path, configName string) util.Path {
	if configName == "" {
		configName = DefaultConfigName
	}
	if !strings.HasSuffix(configName, ".toml") {
		configName += ".toml"
	}
	return GetConfigDir(base).Join(configName)
}

func ListConfigFiles(base util.Path) ([]util.Path, error) {
	dir := GetConfigDir(base)
	return dir.Glob("*.toml")
}

func FromFile(path util.Path) (*Config, error) {
	err := ValidateFile(path)
	if err != nil {
		return nil, err
	}
	cfg := New()
	err = util.ReadTOMLFile(path, cfg)
	if err != nil {
		return nil, err
	}
	return cfg, nil
}

func ValidateFile(path util.Path) error {
	var cfg Config
	validator, err := schema.NewValidator(schema.ConfigSchemaURL, &cfg)
	if err != nil {
		return err
	}
	return validator.ValidateTOMLFile(path)
}

func (cfg *Config) Write(w io.Writer) error {
	enc := toml.NewEncoder(w)
	return enc.Encode(cfg)
}

func (cfg *Config) WriteFile(path util.Path) error {
	err := path.Dir().MkdirAll(0777)
	if err != nil {
		return err
	}
	f, err := path.Create()
	if err != nil {
		return err
	}
	defer f.Close()
	return cfg.Write(f)
}
