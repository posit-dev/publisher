package logging

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"context"
	"errors"
	"log/slog"
	"os"
	"testing"

	"github.com/rstudio/publishing-client/internal/util/utiltest"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/suite"
)

type MultiHandlerSuite struct {
	utiltest.Suite
}

func TestMultiHanlderSuite(t *testing.T) {
	suite.Run(t, new(MultiHandlerSuite))
}

func (s *MultiHandlerSuite) TestNewMultiHandler() {
	h1 := NewMockHandler()
	h2 := NewMockHandler()

	multiHandler := NewMultiHandler(h1, h2)
	s.Equal([]slog.Handler{h1, h2}, multiHandler.handlers)
}

func (s *MultiHandlerSuite) TestEnabled() {
	// MultiHandler is enabled at a level if any of its handlers are
	h1 := slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelWarn})
	h2 := slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelInfo})

	multiHandler := NewMultiHandler(h1, h2)
	s.False(multiHandler.Enabled(context.Background(), slog.LevelDebug))
	s.True(multiHandler.Enabled(context.Background(), slog.LevelInfo))
	s.True(multiHandler.Enabled(context.Background(), slog.LevelWarn))
	s.True(multiHandler.Enabled(context.Background(), slog.LevelError))
}

func (s *MultiHandlerSuite) TestHandle() {
	h1 := NewMockHandler()
	h2 := NewMockHandler()

	h1.On("Enabled", mock.Anything, slog.LevelInfo).Return(true)
	h2.On("Enabled", mock.Anything, slog.LevelInfo).Return(false)
	h1.On("Handle", mock.Anything, mock.Anything).Return(nil)

	multiHandler := NewMultiHandler(h1, h2)
	record := slog.Record{
		Level:   slog.LevelInfo,
		Message: "message",
	}
	multiHandler.Handle(context.Background(), record)
	h1.AssertExpectations(s.T())
	h2.AssertExpectations(s.T())
}

func (s *MultiHandlerSuite) TestHandleError() {
	baseHandler := NewMockHandler()
	testError := errors.New("test error from Handle")
	baseHandler.On("Enabled", mock.Anything, slog.LevelInfo).Return(true)
	baseHandler.On("Handle", mock.Anything, mock.Anything).Return(testError)

	multiHandler := NewMultiHandler(baseHandler)
	record := slog.Record{
		Level:   slog.LevelInfo,
		Message: "message",
	}
	err := multiHandler.Handle(context.Background(), record)
	s.ErrorIs(err, testError)
	baseHandler.AssertExpectations(s.T())
}

func (s *MultiHandlerSuite) TestWithAttrs() {
	h1 := NewMockHandler()
	h2 := NewMockHandler()
	h1WithAttrs := NewMockHandler()
	h2WithAttrs := NewMockHandler()

	attr := slog.Attr{
		Key:   "att",
		Value: slog.StringValue("value"),
	}
	attrs := []slog.Attr{attr}
	h1.On("WithAttrs", attrs).Return(h1WithAttrs)
	h2.On("WithAttrs", attrs).Return(h2WithAttrs)

	multiHandler := NewMultiHandler(h1, h2)
	returnedHandler := multiHandler.WithAttrs(attrs)
	s.Equal(NewMultiHandler(h1WithAttrs, h2WithAttrs), returnedHandler)
	h1.AssertExpectations(s.T())
	h2.AssertExpectations(s.T())
}

func (s *MultiHandlerSuite) TestWithGroup() {
	h1 := NewMockHandler()
	h2 := NewMockHandler()
	h1WithGroup := NewMockHandler()
	h2WithGroup := NewMockHandler()
	h1.On("WithGroup", "group").Return(h1WithGroup)
	h2.On("WithGroup", "group").Return(h2WithGroup)

	multiHandler := NewMultiHandler(h1, h2)
	returnedHandler := multiHandler.WithGroup("group")
	s.Equal(NewMultiHandler(h1WithGroup, h2WithGroup), returnedHandler)
	h1.AssertExpectations(s.T())
	h2.AssertExpectations(s.T())
}

func (s *MultiHandlerSuite) TestWithGroupEmptyName() {
	baseHandler := NewMockHandler()
	multiHandler := NewMultiHandler(baseHandler)
	returnedHandler := multiHandler.WithGroup("")
	s.Equal(multiHandler, returnedHandler)
	baseHandler.AssertExpectations(s.T())
}
