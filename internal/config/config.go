package config

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"
	"io"
	"io/fs"
	"strings"

	"github.com/pelletier/go-toml/v2"
	"github.com/rstudio/connect-client/internal/util"
)

const ConfigSchema SchemaURL = "https://github.com/rstudio/publishing-client/blob/main/schemas/posit-publishing-schema-v3.json"

const DefaultConfigName = "default"

func NewConfig() *Config {
	return &Config{
		Schema: ConfigSchema,
	}
}

func GetConfigPath(base util.Path, configName string) util.Path {
	if configName == "" {
		configName = DefaultConfigName
	}
	if !strings.HasSuffix(configName, ".toml") {
		configName += ".toml"
	}
	return base.Join(".posit", "publish", configName)
}

func ReadConfig(r io.Reader) (*Config, error) {
	dec := toml.NewDecoder(r)
	dec.DisallowUnknownFields()
	cfg := new(Config)
	err := dec.Decode(cfg)
	return cfg, err
}

func ReadConfigFile(path util.Path) (*Config, error) {
	f, err := path.Open()
	if err != nil {
		return nil, err
	}
	defer f.Close()
	return ReadConfig(f)
}

func ReadOrCreateConfigFile(path util.Path) (*Config, error) {
	cfg, err := ReadConfigFile(path)
	if errors.Is(err, fs.ErrNotExist) {
		cfg = NewConfig()
		err = WriteConfigFile(cfg, path)
	}
	return cfg, err
}

func WriteConfig(cfg *Config, w io.Writer) error {
	enc := toml.NewEncoder(w)
	return enc.Encode(cfg)
}

func WriteConfigFile(cfg *Config, path util.Path) error {
	err := path.Dir().MkdirAll(0777)
	if err != nil {
		return err
	}
	f, err := path.Create()
	if err != nil {
		return err
	}
	defer f.Close()
	return WriteConfig(cfg, f)
}
