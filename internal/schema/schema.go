package schema

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"bytes"
	"embed"
	"fmt"
	"io"
	"strings"

	"github.com/rstudio/connect-client/internal/types"
	"github.com/rstudio/connect-client/internal/util"
	"github.com/santhosh-tekuri/jsonschema/v5"
)

//go:embed schemas
var schemaFS embed.FS

const schemaPrefix = "https://cdn.posit.co/publisher/schemas/"
const ConfigSchemaURL = schemaPrefix + "posit-publishing-schema-v3.json"
const DeploymentSchemaURL = schemaPrefix + "posit-publishing-record-schema-v3.json"

type Validator[T any] struct {
	schema *jsonschema.Schema
}

func NewValidator[T any](schemaURL string) (*Validator[T], error) {
	jsonschema.Loaders = map[string]func(url string) (io.ReadCloser, error){
		"https": loadSchema,
	}
	schema, err := jsonschema.Compile(schemaURL)
	if err != nil {
		return nil, err
	}
	return &Validator[T]{
		schema: schema,
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

func (v *Validator[T]) ValidateTOMLFile(path util.Path) error {
	// First, try to read the TOML into the object.
	// This will return nicer errors from the toml package
	// for things like fields that cannot be mapped.
	var typedContent T
	err := util.ReadTOMLFile(path, &typedContent)
	if err != nil {
		return err
	}
	// Read the TOML generically to get the anyContent.
	// Can't use v.object here because Validate
	// doesn't accept some object types.
	var anyContent any
	err = util.ReadTOMLFile(path, &anyContent)
	if err != nil {
		return err
	}
	err = v.schema.Validate(anyContent)
	if err != nil {
		validationErr, ok := err.(*jsonschema.ValidationError)
		if ok {
			// Return all causes in the Data field of a single error.
			e := toTomlValidationError(validationErr)
			return types.NewAgentError(tomlValidationErrorCode, e, nil)
		} else {
			return err
		}
	}
	return nil
}

func loadSchema(url string) (io.ReadCloser, error) {
	name := strings.TrimPrefix(url, schemaPrefix)
	content, err := schemaFS.ReadFile("schemas/" + name)
	if err != nil {
		return nil, err
	}
	return io.NopCloser(bytes.NewReader(content)), nil
}
