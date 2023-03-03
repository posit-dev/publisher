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

func (opt *Optional[T]) Get() (T, bool) {
	return opt.value, opt.valid
}

var NULL = []byte("null")

func (opt *Optional[T]) UnmarshalJSON(data []byte) error {
	if bytes.Equal(data, NULL) {
		opt.valid = false
		return nil
	}
	if err := json.Unmarshal(data, &opt.value); err != nil {
		return err
	}
	opt.valid = true
	return nil
}

func (opt Optional[T]) MarshalJSON() ([]byte, error) {
	if opt.valid {
		return json.Marshal(opt.value)
	} else {
		return NULL, nil
	}
}

func NewOptional[T any](value T) Optional[T] {
	return Optional[T]{
		value: value,
		valid: true,
	}
}
