package detectors

import (
	"github.com/posit-dev/publisher/internal/logging"
	"github.com/posit-dev/publisher/internal/util"
)

// Copyright (C) 2025 by Posit Software, PBC.

func makeResourceFinderFactoryMock(rfMock *resourceFinderMock, err error) multiResourceFinderFactory {
	return func(log logging.Logger, base util.AbsolutePath, filesFromConfig []string) (ResourceFinder, error) {
		return rfMock, err
	}
}

type resourceFinderMock struct {
	resources []ExternalResource
	err       error
}

func (m *resourceFinderMock) FindResources() ([]ExternalResource, error) {
	return m.resources, m.err
}
