package rslog

// Copyright (C) 2022 by RStudio, PBC.

import (
	"fmt"
	"io"
	"sync"

	"github.com/sirupsen/logrus"
)

// DeprecatedCapturingLogger is a direct logger that remembers _all_ its logged
// messages. Useful for tests.
type DeprecatedCapturingLogger struct {
	directLogger
	Messages []string
}

func (logger *DeprecatedCapturingLogger) Logf(msg string, args ...interface{}) {
	logger.Messages = append(logger.Messages,
		fmt.Sprintf(msg, args...),
	)
	logger.directLogger.Logf(msg, args...)
}

func (logger *DeprecatedCapturingLogger) Output(msg string) {
	logger.Messages = append(logger.Messages, msg)
}

func (logger *DeprecatedCapturingLogger) Reset() {
	logger.Messages = nil
}

// DeprecatedCaptureOnlyLogger is a logger that remembers its logged
// messages, but doesn't log them anywhere else.
type DeprecatedCaptureOnlyLogger struct {
	Messages []string
}

func (logger *DeprecatedCaptureOnlyLogger) Logf(msg string, args ...interface{}) {
	logger.Output(fmt.Sprintf(msg, args...))
}

func (logger *DeprecatedCaptureOnlyLogger) Output(msg string) {
	logger.Messages = append(logger.Messages, msg)
}

func (logger *DeprecatedCaptureOnlyLogger) Reset() {
	logger.Messages = nil
}

func (logger *DeprecatedCaptureOnlyLogger) Debugf(msg string, args ...interface{}) {
	logger.Messages = append(logger.Messages, fmt.Sprintf(msg, args...))
}

func (logger *DeprecatedCaptureOnlyLogger) Tracef(msg string, args ...interface{}) {
	logger.Messages = append(logger.Messages, fmt.Sprintf(msg, args...))
}

func (logger *DeprecatedCaptureOnlyLogger) Infof(msg string, args ...interface{}) {
	logger.Messages = append(logger.Messages, fmt.Sprintf(msg, args...))
}

func (logger *DeprecatedCaptureOnlyLogger) Warnf(msg string, args ...interface{}) {
	logger.Messages = append(logger.Messages, fmt.Sprintf(msg, args...))
}

func (logger *DeprecatedCaptureOnlyLogger) Errorf(msg string, args ...interface{}) {
	logger.Messages = append(logger.Messages, fmt.Sprintf(msg, args...))
}

func (logger *DeprecatedCaptureOnlyLogger) Fatalf(msg string, args ...interface{}) {
	logger.Messages = append(logger.Messages, fmt.Sprintf(msg, args...))
}

func (logger *DeprecatedCaptureOnlyLogger) Fatal(args ...interface{}) {
	logger.Messages = append(logger.Messages, fmt.Sprint(args...))
}

func (logger *DeprecatedCaptureOnlyLogger) Panicf(msg string, args ...interface{}) {
	logger.Messages = append(logger.Messages, fmt.Sprintf(msg, args...))
}

func (logger *DeprecatedCaptureOnlyLogger) WithField(key string, value interface{}) Logger {
	return logger
}

func (logger *DeprecatedCaptureOnlyLogger) WithFields(fields Fields) Logger {
	return logger
}

func (logger *DeprecatedCaptureOnlyLogger) SetLevel(_ LogLevel) {
}

func (logger *DeprecatedCaptureOnlyLogger) SetFormatter(_ OutputFormat) {
}

func (logger *DeprecatedCaptureOnlyLogger) SetOutput(writers ...io.Writer) {
}

type CapturingLogger struct {
	Logger
	hook *captureMessageHook
}

type CapturingLoggerOptions struct {
	Level        LogLevel
	WithMetadata bool
}

func NewCapturingLogger(options CapturingLoggerOptions) CapturingLogger {

	l, _ := NewLoggerImpl(LoggerOptionsImpl{
		Level:  options.Level,
		Format: TextFormat,
	}, discardOutputBuilder{})

	h := new(captureMessageHook)
	h.metadata = options.WithMetadata
	l.CoreLogger.AddHook(h)

	return CapturingLogger{
		Logger: l,
		hook:   h,
	}
}

func (l *CapturingLogger) Messages() []string {
	return l.hook.Messages()
}

func (l *CapturingLogger) Clear() {
	l.hook.Clear()
}

type captureMessageHook struct {
	messages []string
	metadata bool
	mu       sync.RWMutex
}

func (h *captureMessageHook) Messages() []string {
	h.mu.RLock()
	defer h.mu.RUnlock()

	return h.messages
}

func (h *captureMessageHook) Clear() {
	h.mu.Lock()
	defer h.mu.Unlock()

	h.messages = make([]string, 0)
}

func (h *captureMessageHook) Fire(e *logrus.Entry) error {
	h.mu.Lock()
	defer h.mu.Unlock()

	if h.metadata {
		msg, err := e.String()
		if err != nil {
			return err
		}
		h.messages = append(h.messages, msg)
	} else {
		h.messages = append(h.messages, e.Message)
	}

	return nil
}

func (h *captureMessageHook) Levels() []logrus.Level {
	return logrus.AllLevels
}
