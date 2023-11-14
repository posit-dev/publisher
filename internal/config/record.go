package config

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"io"

	"github.com/pelletier/go-toml/v2"
)

const RecordSchema SchemaURL = "https://github.com/rstudio/publishing-client/blob/main/schemas/posit-publishing-record-schema-v3.json"

func NewDeploymentRecord() *DeploymentRecord {
	return &DeploymentRecord{
		Schema:        RecordSchema,
		Configuration: *NewConfiguration(),
	}
}

func ReadDeploymentRecord(r io.Reader) (*DeploymentRecord, error) {
	dec := toml.NewDecoder(r)
	dec.DisallowUnknownFields()
	record := new(DeploymentRecord)
	err := dec.Decode(record)
	return record, err
}

func WriteDeploymentRecord(record *DeploymentRecord, w io.Writer) error {
	enc := toml.NewEncoder(w)
	return enc.Encode(record)
}
