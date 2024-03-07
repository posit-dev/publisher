package events

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"testing"

	"github.com/rstudio/connect-client/internal/util/utiltest"
	"github.com/stretchr/testify/suite"
)

type EventsSuite struct {
	utiltest.Suite
}

func TestEventsSuite(t *testing.T) {
	suite.Run(t, new(EventsSuite))
}

func (s *EventsSuite) TestEventTypeOf() {
	expected := "publish/createBundle/start"
	actual := EventTypeOf(PublishCreateBundleOp, StartPhase)
	s.Equal(expected, actual)
}
