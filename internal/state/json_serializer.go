package state

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"encoding/json"
	"fmt"

	"github.com/rstudio/connect-client/internal/util"
	"github.com/rstudio/platform-lib/pkg/rslog"
)

type jsonSerializer struct {
	dir    util.Path
	logger rslog.Logger
}

func newJsonSerializer(dir util.Path, logger rslog.Logger) *jsonSerializer {
	return &jsonSerializer{
		dir:    dir,
		logger: logger,
	}
}

var _ deploymentSerializer = &jsonSerializer{}

func (s *jsonSerializer) Save(label MetadataLabel, src any) error {
	path := s.dir.Join(fmt.Sprintf("%s.json", label))
	f, err := path.Create()
	if err != nil {
		return err
	}
	defer f.Close()
	encoder := json.NewEncoder(f)
	err = encoder.Encode(src)
	if err != nil {
		return fmt.Errorf("error writing JSON file %s: %w", path, err)
	}
	s.logger.Infof("Saved %s metadata to %s", label, path)
	return nil
}

func (s *jsonSerializer) Load(label MetadataLabel, dest any) error {
	path := s.dir.Join(fmt.Sprintf("%s.json", label))
	f, err := path.Open()
	if err != nil {
		return err
	}
	defer f.Close()
	decoder := json.NewDecoder(f)
	err = decoder.Decode(dest)
	if err != nil {
		return fmt.Errorf("cannot parse JSON file %s: %w", path, err)
	}
	s.logger.Infof("Loaded %s metadata from %s", label, path)
	return nil
}
