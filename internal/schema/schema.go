package schema

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"bytes"
	"embed"
	"fmt"
	"io"
	"strings"

	"github.com/santhosh-tekuri/jsonschema/v5"

	"github.com/posit-dev/publisher/internal/types"
	"github.com/posit-dev/publisher/internal/util"
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
	KeywordLocation string
}

func (e *tomlValidationError) Error() string {
	if e.Key != "" {
		return fmt.Sprintf("%s: %s", e.Key, e.Problem)
	}
	return e.Problem
}

type multiTomlValidationError struct {
	Errors []tomlValidationError `mapstructure:"errors"`

	// These top-level fields represent the first error in Errors as mapstructure is unable to convert structs in slice.
	// See https://github.com/go-viper/mapstructure/issues/19
	Key             string `mapstructure:"key"`
	Problem         string `mapstructure:"problem"`
	SchemaReference string `mapstructure:"schema-reference"`
}

func (e *multiTomlValidationError) Error() string {
	errorMsgs := make([]string, len(e.Errors))
	for i, err := range e.Errors {
		errorMsgs[i] = err.Error()
	}
	return strings.Join(errorMsgs, "; ")
}

func collectLeafErrors(e *jsonschema.ValidationError, out *[]*jsonschema.ValidationError) {
	if len(e.Causes) == 0 {
		*out = append(*out, e)
	} else {
		for _, cause := range e.Causes {
			collectLeafErrors(cause, out)
		}
	}
}

func toTomlValidationError(e *jsonschema.ValidationError) *multiTomlValidationError {
	var leafErrors []*jsonschema.ValidationError
	collectLeafErrors(e, &leafErrors)

	var tomlErrors []tomlValidationError
	for _, e := range leafErrors {
		key := e.InstanceLocation
		key = strings.TrimPrefix(key, "/")
		key = strings.ReplaceAll(key, "/", ".")

		tomlErr := tomlValidationError{
			Key:             key,
			Problem:         e.Message,
			SchemaReference: e.AbsoluteKeywordLocation,
			KeywordLocation: e.KeywordLocation,
		}
		tomlErrors = append(tomlErrors, tomlErr)
	}

	filteredTomlErrors := make([]tomlValidationError, 0, len(tomlErrors))

	for i, tomlErr := range tomlErrors {
		shouldAdd := true
		if tomlErr.KeywordLocation == "/unevaluatedProperties" {
			for j, tomlErr2 := range tomlErrors {
				if j != i && strings.HasPrefix(tomlErr2.Key, tomlErr.Key) {
					// unevaluatedProperties is redundant and confusing if there is another error with the same key
					shouldAdd = false
					break
				}
			}
		}
		if shouldAdd {
			filteredTomlErrors = append(filteredTomlErrors, tomlErr)
		}
	}

	return &multiTomlValidationError{
		Errors:          filteredTomlErrors,
		Key:             tomlErrors[0].Key,
		Problem:         tomlErrors[0].Problem,
		SchemaReference: tomlErrors[0].SchemaReference,
	}
}

func (v *Validator[T]) ValidateContent(data any) error {
	err := v.schema.Validate(data)
	if err != nil {
		validationErr, ok := err.(*jsonschema.ValidationError)
		if ok {
			// Return all causes in the Data field of a single error.
			e := toTomlValidationError(validationErr)
			aErr := types.NewAgentError(tomlValidationErrorCode, e, e)
			// NewAgentError uppercases the first letter, but we re-lowercase it since it's a field name.
			aErr.Message = strings.ToLower(aErr.Message[:1]) + aErr.Message[1:]
			return aErr
		} else {
			return err
		}
	}
	return nil
}

func (v *Validator[T]) ValidateTOMLFile(path util.AbsolutePath) error {
	// First, try to read the TOML into the object.
	// This will return nicer errors from the toml package
	// for things like fields that cannot be mapped.
	//var typedContent T
	//err := util.ReadTOMLFile(path, &typedContent)
	//if err != nil {
	//	return err
	//}
	// Read the TOML generically to get the anyContent.
	// Can't use v.object here because Validate
	// doesn't accept some object types.
	var anyContent any
	err := util.ReadTOMLFile(path, &anyContent)
	if err != nil {
		return err
	}
	return v.ValidateContent(anyContent)
}

func loadSchema(url string) (io.ReadCloser, error) {
	name := strings.TrimPrefix(url, schemaPrefix)
	content, err := schemaFS.ReadFile("schemas/" + name)
	if err != nil {
		return nil, err
	}
	return io.NopCloser(bytes.NewReader(content)), nil
}
