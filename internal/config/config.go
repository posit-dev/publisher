package config

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"io"

	"github.com/pelletier/go-toml/v2"
)

const ConfigSchema SchemaURL = "https://github.com/rstudio/publishing-client/blob/main/schemas/posit-publishing-schema-v3.json"

func NewConfiguration() *Configuration {
	return &Configuration{
		Schema: ConfigSchema,
	}
}

func ReadConfig(r io.Reader) (*Configuration, error) {
	dec := toml.NewDecoder(r)
	dec.DisallowUnknownFields()
	cfg := new(Configuration)
	err := dec.Decode(cfg)
	return cfg, err
}

func WriteConfig(cfg *Configuration, w io.Writer) error {
	enc := toml.NewEncoder(w)
	return enc.Encode(cfg)
}
