package state

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"fmt"
	"path/filepath"

	"github.com/rstudio/platform-lib/pkg/rslog"
	"github.com/spf13/afero"
)

type jsonSerializer struct {
	fs     afero.Fs
	dir    string
	logger rslog.Logger
}

func newJsonSerializer(fs afero.Fs, dir string, logger rslog.Logger) *jsonSerializer {
	return &jsonSerializer{
		fs:     fs,
		dir:    dir,
		logger: logger,
	}
}

var _ deploymentSerializer = &jsonSerializer{}

func (s *jsonSerializer) Save(label metadataLabel, src any) error {
	path := filepath.Join(s.dir, fmt.Sprintf("%s.json", label))
	f, err := s.fs.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()
	encoder := json.NewEncoder(f)
	err = encoder.Encode(src)
	if err != nil {
		return fmt.Errorf("Error writing JSON file %s: %w", path, err)
	}
	s.logger.Infof("Saved %s metadata to %s", label, path)
	return nil
}

func (s *jsonSerializer) Load(label metadataLabel, dest any) error {
	path := filepath.Join(s.dir, fmt.Sprintf("%s.json", label))
	f, err := s.fs.Open(path)
	if err != nil {
		return err
	}
	defer f.Close()
	decoder := json.NewDecoder(f)
	err = decoder.Decode(dest)
	if err != nil {
		return fmt.Errorf("Cannot parse JSON file %s: %w", path, err)
	}
	s.logger.Infof("Loaded %s metadata from %s", label, path)
	return nil
}
