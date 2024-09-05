package util

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"fmt"
	"io"
	"strings"

	"github.com/pelletier/go-toml/v2"
	"github.com/posit-dev/publisher/internal/types"
)

func readTOML(r io.Reader, dest any) error {
	dec := toml.NewDecoder(r)
	dec.DisallowUnknownFields()
	return dec.Decode(dest)
}

// DecodeError mirrors toml.DecodeError, with exported fields
type DecodeError struct {
	File    string `mapstructure:"file"`
	Line    int    `mapstructure:"line"`
	Column  int    `mapstructure:"column"`
	Key     string `mapstructure:"key"`
	Problem string `mapstructure:"problem"`
}

func (e *DecodeError) Error() string {
	msg := fmt.Sprintf("%s:%d:%d: %s",
		e.File, e.Line, e.Column, e.Problem)
	if len(e.Key) != 0 {
		msg += fmt.Sprintf(" '%s'", e.Key)
	}
	return msg
}

var substitutions = map[string]string{
	"toml: ":            "",
	"missing field":     "",
	"incomplete number": "unquoted string or incomplete number",
}

func decodeErrFromTOMLErr(e *toml.DecodeError, path AbsolutePath) *DecodeError {
	line, col := e.Position()
	msg := e.Error()
	for old, new := range substitutions {
		msg = strings.ReplaceAll(msg, old, new)
	}
	return &DecodeError{
		File:    path.String(),
		Line:    line,
		Column:  col,
		Key:     strings.Join(e.Key(), "."),
		Problem: msg,
	}
}

const InvalidTOMLCode types.ErrorCode = "invalidTOML"
const UnknownTOMLKeyCode types.ErrorCode = "unknownTOMLKey"

func ReadTOMLFile(path AbsolutePath, dest any) error {
	f, err := path.Open()
	if err != nil {
		return err
	}
	defer f.Close()
	err = readTOML(f, dest)
	if err != nil {
		decodeErr, ok := err.(*toml.DecodeError)
		if ok {
			e := decodeErrFromTOMLErr(decodeErr, path)
			return types.NewAgentError(InvalidTOMLCode, e, nil)
		}
		strictErr, ok := err.(*toml.StrictMissingError)
		if ok {
			e := decodeErrFromTOMLErr(&strictErr.Errors[0], path)
			e.Problem = "unknown key"
			return types.NewAgentError(UnknownTOMLKeyCode, e, nil)
		}
		return err
	}
	return nil
}
