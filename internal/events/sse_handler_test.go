package events

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"context"
	"encoding/json"
	"log/slog"
	"testing"
	"time"

	"github.com/r3labs/sse/v2"
	"github.com/rstudio/publishing-client/internal/events/eventstest"
	"github.com/rstudio/publishing-client/internal/logging"
	"github.com/rstudio/publishing-client/internal/util/utiltest"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
)

type SSEHandlerSuite struct {
	utiltest.Suite
}

func TestSSEHandlerSuite(t *testing.T) {
	suite.Run(t, new(SSEHandlerSuite))
}

func (s *SSEHandlerSuite) TestNewSSEHandlerWithOpts() {
	sseServer := sse.New()
	h := NewSSEHandler(sseServer, &SSEHandlerOptions{
		Level: slog.LevelDebug,
	})
	s.Equal(&SSEHandler{
		server: sseServer,
		opts: SSEHandlerOptions{
			Level: slog.LevelDebug,
		},
		attrs: nil,
	}, h)
}

func (s *SSEHandlerSuite) TestNewSSEHandlerNoOpts() {
	sseServer := sse.New()
	h := NewSSEHandler(sseServer, nil)
	s.Equal(&SSEHandler{
		server: sseServer,
		opts: SSEHandlerOptions{
			Level: slog.LevelInfo,
		},
		attrs: nil,
	}, h)
}

func (s *SSEHandlerSuite) TestEnabled() {
	h := NewSSEHandler(nil, &SSEHandlerOptions{
		Level: slog.LevelInfo,
	})
	s.False(h.Enabled(context.Background(), slog.LevelDebug))
	s.True(h.Enabled(context.Background(), slog.LevelInfo))
	s.True(h.Enabled(context.Background(), slog.LevelWarn))
	s.True(h.Enabled(context.Background(), slog.LevelError))
}

func (s *SSEHandlerSuite) TestWithAttrs() {
	handler := NewSSEHandler(nil, nil)
	attrs := []slog.Attr{
		{Key: "hey", Value: slog.StringValue("there")},
		{Key: "x", Value: slog.StringValue("marks the spot")},
	}
	handlerWithAttrs := handler.WithAttrs(attrs)
	s.NotEqual(handler, handlerWithAttrs)
	s.Nil(handler.attrs)

	sseHandler, ok := handlerWithAttrs.(*SSEHandler)
	s.True(ok)
	s.Equal(attrs, sseHandler.attrs)
}

func (s *SSEHandlerSuite) TestWithGroup() {
	handler := NewSSEHandler(nil, nil)
	handlerWithGroup := handler.WithGroup("hi")
	s.Equal(handler, handlerWithGroup)
}

func (s *SSEHandlerSuite) TestHandleNoAttrs() {
	server := eventstest.NewMockSSEServer()
	handler := NewSSEHandler(server, nil)

	t, err := time.Parse(time.RFC3339, "2023-08-30T08:22:01-04:00")
	s.NoError(err)
	rec := slog.Record{
		Time:    t,
		Message: "log message",
		Level:   slog.LevelInfo,
	}

	server.On("Publish", "messages", mock.Anything).Run(func(args mock.Arguments) {
		sseEvent := args.Get(1).(*sse.Event)
		s.Equal(sseEvent.Event, []byte("message"))
		var event AgentEvent
		err := json.Unmarshal(sseEvent.Data, &event)
		s.NoError(err)
		s.Equal("log message", event.Data["Message"])
		s.Equal("INFO", event.Data["Level"])
		s.Equal("agent/log", event.Type)
	})
	err = handler.Handle(context.Background(), rec)
	s.NoError(err)

}

func (s *SSEHandlerSuite) TestHandleWithAttrs() {
	server := eventstest.NewMockSSEServer()
	handler := NewSSEHandler(server, nil)

	t, err := time.Parse(time.RFC3339, "2023-08-30T08:22:01-04:00")
	s.NoError(err)
	rec := slog.Record{
		Time:    t,
		Message: "log message",
		Level:   slog.LevelInfo,
	}
	// Attrs can appear in the handler or in the record.
	// Record attrs take precedence.
	handlerWithAttrs := handler.WithAttrs([]slog.Attr{
		{
			Key:   logging.LogKeyOp,
			Value: slog.StringValue("someOperation/step"),
		},
		{
			// This will be overridden by the attr in the record
			Key:   logging.LogKeyPhase,
			Value: slog.StringValue(string(logging.StartPhase)),
		},
	})
	rec.AddAttrs(
		slog.Attr{
			Key:   logging.LogKeyPhase,
			Value: slog.StringValue(string(logging.FailurePhase)),
		},
		slog.Attr{
			Key:   logging.LogKeyErrCode,
			Value: slog.StringValue(string("myErrCode")),
		},
		slog.Attr{
			Key:   "random_number",
			Value: slog.IntValue(123),
		},
		slog.Attr{
			Key:   "",
			Value: slog.StringValue(""),
		},
	)
	server.On("Publish", "messages", mock.Anything).Run(func(args mock.Arguments) {
		sseEvent := args.Get(1).(*sse.Event)
		s.Equal(sseEvent.Event, []byte("message"))
		var event AgentEvent
		err := json.Unmarshal(sseEvent.Data, &event)
		s.NoError(err)
		s.Equal("log message", event.Data["Message"])
		s.Equal("INFO", event.Data["Level"])
		s.Equal("someOperation/step/failure/myErrCode", event.Type)
		s.Equal(float64(123), event.Data["random_number"])
	})
	err = handlerWithAttrs.Handle(context.Background(), rec)
	s.NoError(err)

}
