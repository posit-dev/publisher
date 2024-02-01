package events

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"testing"

	"github.com/rstudio/connect-client/internal/types"
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
	actual := EventTypeOf(PublishCreateBundleOp, StartPhase, types.UnknownErrorCode)
	s.Equal(expected, actual)
}

func (s *EventsSuite) TestEventTypeOfFailure() {
	expected := "publish/createBundle/failure/authFailure"
	actual := EventTypeOf(PublishCreateBundleOp, FailurePhase, ErrorCode("authFailure"))
	s.Equal(expected, actual)
}
