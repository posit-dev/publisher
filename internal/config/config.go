package config

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"fmt"
	"io"
	"strings"

	"github.com/pelletier/go-toml/v2"
	"github.com/posit-dev/publisher/internal/schema"
	"github.com/posit-dev/publisher/internal/util"
)

const DefaultConfigName = "default"

func New() *Config {
	return &Config{
		Schema:   schema.ConfigSchemaURL,
		Type:     ContentTypeUnknown,
		Validate: true,
		Files:    []string{"*"},
	}
}

func GetConfigDir(base util.AbsolutePath) util.AbsolutePath {
	return base.Join(".posit", "publish")
}

func GetConfigPath(base util.AbsolutePath, configName string) util.AbsolutePath {
	if configName == "" {
		configName = DefaultConfigName
	}
	if !strings.HasSuffix(configName, ".toml") {
		configName += ".toml"
	}
	return GetConfigDir(base).Join(configName)
}

func ListConfigFiles(base util.AbsolutePath) ([]util.AbsolutePath, error) {
	dir := GetConfigDir(base)
	return dir.Glob("*.toml")
}

func readLeadingComments(path util.AbsolutePath) ([]string, error) {
	var comments []string
	contents, err := path.ReadFile()
	if err != nil {
		return nil, err
	}
	lines := strings.Split(string(contents), "\n")
	for _, line := range lines {
		if !strings.HasPrefix(line, "#") {
			break
		}
		comments = append(comments, line[1:])
	}
	return comments, nil
}

func FromFile(path util.AbsolutePath) (*Config, error) {
	err := ValidateFile(path)
	if err != nil {
		return nil, err
	}
	cfg := New()
	err = util.ReadTOMLFile(path, cfg)
	if err != nil {
		return nil, err
	}
	cfg.Comments, err = readLeadingComments(path)
	if err != nil {
		return nil, err
	}
	return cfg, nil
}

func ValidateFile(path util.AbsolutePath) error {
	validator, err := schema.NewValidator[Config](schema.ConfigSchemaURL)
	if err != nil {
		return err
	}
	return validator.ValidateTOMLFile(path)
}

func (cfg *Config) Write(w io.Writer) error {
	for _, comment := range cfg.Comments {
		_, err := fmt.Fprintln(w, "#"+comment)
		if err != nil {
			return err
		}
	}
	enc := toml.NewEncoder(w)
	return enc.Encode(cfg)
}

func (cfg *Config) WriteFile(path util.AbsolutePath) error {
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
