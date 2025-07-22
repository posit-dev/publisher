package schema

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"bytes"
	"embed"
	"errors"
	"fmt"
	"io"
	"strings"

	"github.com/posit-dev/publisher/internal/types"
	"github.com/posit-dev/publisher/internal/util"
	"github.com/santhosh-tekuri/jsonschema/v5"
)

//go:embed schemas
var schemaFS embed.FS

const schemaPrefix = "https://cdn.posit.co/publisher/schemas/"
const ConfigSchemaURL = schemaPrefix + "posit-publishing-schema-v4.json"
const DeploymentSchemaURL = schemaPrefix + "posit-publishing-record-schema-v4.json"

var ConfigSchemaURLs = []string{
	schemaPrefix + "posit-publishing-schema-v3.json",
	ConfigSchemaURL,
	schemaPrefix + "draft/posit-publishing-schema-v3.json",
	schemaPrefix + "draft/posit-publishing-schema-v4.json",
}
var DeploymentSchemaURLs = []string{
	schemaPrefix + "posit-publishing-record-schema-v3.json",
	DeploymentSchemaURL,
	schemaPrefix + "draft/posit-publishing-record-schema-v3.json",
	schemaPrefix + "draft/posit-publishing-record-schema-v4.json",
}

type Validator[T any] struct {
	schemas map[string]*jsonschema.Schema
}

func NewValidator[T any](schemaURLs []string) (*Validator[T], error) {
	jsonschema.Loaders = map[string]func(url string) (io.ReadCloser, error){
		"https": loadSchema,
	}
	schemas := make(map[string]*jsonschema.Schema)
	for _, url := range schemaURLs {
		schema, err := jsonschema.Compile(url)
		if err != nil {
			return nil, err
		}
		schemas[url] = schema
	}
	return &Validator[T]{
		schemas: schemas,
	}, nil
}

const tomlValidationErrorCode types.ErrorCode = "tomlValidationError"

type tomlValidationError struct {
	Key             string `mapstructure:"key"`
	Problem         string `mapstructure:"problem"`
	SchemaReference string `mapstructure:"schema-reference"`
}

func (e *tomlValidationError) Error() string {
	return fmt.Sprintf("%s: %s", e.Key, e.Problem)
}

func toTomlValidationError(e *jsonschema.ValidationError) *tomlValidationError {
	if len(e.Causes) != 0 {
		e = e.Causes[0]
	}
	key := e.InstanceLocation
	key = strings.TrimPrefix(key, "/")
	key = strings.ReplaceAll(key, "/", ".")

	return &tomlValidationError{
		Key:             key,
		Problem:         e.Message,
		SchemaReference: e.AbsoluteKeywordLocation,
	}
}

func (v *Validator[T]) ValidateContent(data map[string]interface{}) error {
	pertinentSchemaURL, ok := data["$schema"]
	if !ok {
		return errors.New("no $schema field found in data")
	}

	pertinentSchemaURLString, ok := pertinentSchemaURL.(string)
	if !ok {
		return errors.New("$schema field must a string")
	}

	schema, ok := v.schemas[pertinentSchemaURLString]
	if !ok {
		return fmt.Errorf("schema not supported: %s", pertinentSchemaURL)
	}

	err := schema.Validate(data)
	if err != nil {
		validationErr, ok := err.(*jsonschema.ValidationError)
		if ok {
			// Return all causes in the Data field of a single error.
			e := toTomlValidationError(validationErr)
			return types.NewAgentError(tomlValidationErrorCode, e, e)
		} else {
			return err
		}
	}
	return nil
}

func (v *Validator[T]) ValidateTOMLFile(path util.AbsolutePath) (map[string]interface{}, error) {
	// First, try to read the TOML into the object.
	// This will return nicer errors from the toml package
	// for things like fields that cannot be mapped.
	var typedContent T
	err := util.ReadTOMLFile(path, &typedContent)
	if err != nil {
		return nil, err
	}
	// Read the TOML generically to get the anyContent.
	// Can't use v.object here because Validate
	// doesn't accept some object types.
	var anyContent map[string]interface{}
	err = util.ReadTOMLFile(path, &anyContent)
	if err != nil {
		return nil, err
	}
	return anyContent, v.ValidateContent(anyContent)
}

func loadSchema(url string) (io.ReadCloser, error) {
	name := strings.TrimPrefix(url, schemaPrefix)
	content, err := schemaFS.ReadFile("schemas/" + name)
	if err != nil {
		return nil, err
	}
	return io.NopCloser(bytes.NewReader(content)), nil
}
