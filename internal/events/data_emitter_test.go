package events

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"testing"

	"github.com/posit-dev/publisher/internal/util/utiltest"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
)

type DataEmitterSuite struct {
	utiltest.Suite
}

func TestDataEmitterSuite(t *testing.T) {
	suite.Run(t, new(DataEmitterSuite))
}

func (s *LoggerSuite) TestNewDataEmitter() {
	baseEmitter := NewMockEmitter()
	data := EventData{
		"hi": "there",
	}

	emitter := NewDataEmitter(data, baseEmitter)
	s.Equal(data, emitter.data)
	s.Equal(baseEmitter, emitter.emitter)
}

func (s *LoggerSuite) TestEmit() {
	baseEmitter := NewMockEmitter()
	baseEmitter.On("Emit", mock.Anything).Return(nil)

	data := EventData{
		"hi": "there",
	}
	emitter := NewDataEmitter(data, baseEmitter)
	event := Event{
		Data: EventData{
			"hello": "world",
			"hi":    "everyone",
		},
	}

	emitter.Emit(&event)

	s.Equal(EventData{
		"hello": "world",
		"hi":    "there",
	}, event.Data)
}

func (s *LoggerSuite) TestEmitNilEventData() {
	baseEmitter := NewMockEmitter()
	baseEmitter.On("Emit", mock.Anything).Return(nil)

	data := EventData{
		"hi": "there",
	}
	emitter := NewDataEmitter(data, baseEmitter)
	event := Event{}

	emitter.Emit(&event)

	s.Equal(EventData{
		"hi": "there",
	}, event.Data)
}
