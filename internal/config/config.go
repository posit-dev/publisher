package config

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"errors"
	"fmt"
	"io"
	"strings"

	"github.com/pelletier/go-toml/v2"

	"github.com/posit-dev/publisher/internal/clients/types"
	"github.com/posit-dev/publisher/internal/contenttypes"
	"github.com/posit-dev/publisher/internal/schema"
	"github.com/posit-dev/publisher/internal/util"
)

const DefaultConfigName = "default"

func New() *Config {
	validate := true
	return &Config{
		Schema:   schema.ConfigSchemaURL,
		Type:     contenttypes.ContentTypeUnknown,
		Validate: &validate,
		Files:    []string{},
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
	cfg.PopulateDefaults()

	err = validate(cfg)
	if err != nil {
		return nil, err
	}

	return cfg, nil
}

// validate performs additional validation beyond schema validation. This validation is intended only to apply to an
// existing config file, not to a new config file being created.
func validate(cfg *Config) error {
	_, err := types.CloudContentTypeFromPublisherType(cfg.Type)
	return err
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

func (cfg *Config) AddSecret(secret string) error {
	// Check if the secret already exists before adding
	for _, s := range cfg.Secrets {
		if s == secret {
			return nil // Secret already exists, no need to add
		}
	}
	// Check if the secret name already exists in the environment
	for e := range cfg.Environment {
		if e == secret {
			return errors.New("secret name already exists in environment")
		}
	}

	cfg.Secrets = append(cfg.Secrets, secret)
	return nil
}

func (cfg *Config) RemoveSecret(secret string) error {
	for i, s := range cfg.Secrets {
		if s == secret {
			cfg.Secrets = append(cfg.Secrets[:i], cfg.Secrets[i+1:]...)
			break
		}
	}
	return nil
}

//func CloudContentTypeFromPublisherType(contentType ContentType) (types.ContentType, error) {
//	switch contentType {
//	case ContentTypeJupyterNotebook:
//		return types.ContentTypeJupyter, nil
//	case ContentTypePythonBokeh:
//		return types.ContentTypeBokeh, nil
//	case ContentTypePythonDash:
//		return types.ContentTypeDash, nil
//	case ContentTypePythonShiny, ContentTypeRShiny:
//		return types.ContentTypeShiny, nil
//	case ContentTypePythonStreamlit:
//		return types.ContentTypeStreamlit, nil
//	case ContentTypeQuartoDeprecated, ContentTypeQuarto, ContentTypeHTML:
//		return types.ContentTypeQuarto, nil
//	case ContentTypeRMarkdown:
//		return types.ContentTypeRMarkdown, nil
//	}
//	return "", fmt.Errorf("content type '%s' is not supported by Connect Cloud", contentType)
//}
