package rslog

// Copyright (C) 2022 by RStudio, PBC.

import "io"

// A logger that drops all messages. Useful for tests.
type discardLogger struct{}

func (discardLogger) Logf(msg string, args ...interface{})   {}
func (discardLogger) Debugf(msg string, args ...interface{}) {}
func (discardLogger) Tracef(msg string, args ...interface{}) {}
func (discardLogger) Infof(msg string, args ...interface{})  {}
func (discardLogger) Warnf(msg string, args ...interface{})  {}
func (discardLogger) Errorf(msg string, args ...interface{}) {}
func (discardLogger) Fatalf(msg string, args ...interface{}) {}
func (discardLogger) Fatal(args ...interface{})              {}
func (discardLogger) Panicf(msg string, v ...interface{})    {}

// Doing nothing with the provided values. Just to implement the interface and be able to switch to old logging implementation
func (l discardLogger) WithField(key string, value interface{}) Logger {
	return l
}

// Doing nothing with the provided values. Just to implement the interface and be able to switch to old logging implementation
func (l discardLogger) WithFields(fields Fields) Logger {
	return l
}

// Doing nothing with the provided values. Just to implement the interface and be able to switch to old logging implementation
func (l discardLogger) WithCorrelationID(correlationID string) Logger {
	return l
}

func (discardLogger) SetLevel(level LogLevel)        {}
func (discardLogger) SetOutput(writers ...io.Writer) {}
func (discardLogger) SetFormatter(_ OutputFormat)    {}
func (discardLogger) OnConfigReload(level LogLevel)  {}

// DiscardLogger for legacy usage.
// TODO: Remove this.
var DiscardLogger discardLogger = discardLogger{}

type discardOutputter struct{}

func (discardOutputter) Output(msg string) {}

// An output logger that drops all messages. Useful for tests.
type discardOutputLogger struct {
	discardLogger
	discardOutputter
}

func NewDiscardingLogger() Logger {
	l, _ := NewLoggerImpl(LoggerOptionsImpl{}, discardOutputBuilder{})
	return l
}
