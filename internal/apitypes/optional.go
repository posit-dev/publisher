package apitypes

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"bytes"
	"encoding/json"
)

type Optional[T any] struct {
	value T
	valid bool
}

func NewOptional[T any](value T) Optional[T] {
	return Optional[T]{
		value: value,
		valid: true,
	}
}

func (opt *Optional[T]) Get() (T, bool) {
	return opt.value, opt.valid
}

func (opt *Optional[T]) Valid() bool {
	return opt.valid
}

var JSON_NULL = []byte("null")

func (opt Optional[T]) MarshalJSON() ([]byte, error) {
	if opt.valid {
		return json.Marshal(opt.value)
	} else {
		return JSON_NULL, nil
	}
}

func (opt *Optional[T]) UnmarshalJSON(data []byte) error {
	if bytes.Equal(data, JSON_NULL) || len(data) == 0 {
		opt.valid = false
		return nil
	}
	if err := json.Unmarshal(data, &opt.value); err != nil {
		return err
	}
	opt.valid = true
	return nil
}
