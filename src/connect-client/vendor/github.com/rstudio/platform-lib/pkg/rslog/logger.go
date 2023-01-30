package rslog

// Copyright (C) 2022 by RStudio, PBC.

import (
	"fmt"
	"io"
	"log"
	"strings"
)

type CoreLoggerImpl interface {
	Debugf(msg string, args ...interface{})
	Infof(msg string, args ...interface{})
	Warnf(msg string, args ...interface{})
	Errorf(msg string, args ...interface{})
	Fatalf(msg string, args ...interface{})
	Fatal(args ...interface{})
	Panicf(msg string, args ...interface{})
	Tracef(msg string, args ...interface{})
}

type Logger interface {
	CoreLoggerImpl

	WithField(key string, value interface{}) Logger
	WithFields(fields Fields) Logger

	SetOutput(writers ...io.Writer)
	SetLevel(level LogLevel)
	SetFormatter(formatter OutputFormat)

	// DeprecatedLogger helps with migrating packages that inject the Logger interface into other packages.
	// TODO: Remove this interface when the migration process to the new logging standard is complete.
	DeprecatedLogger
}

type LoggerFactory interface {
	DefaultLogger() Logger
}

type Fields map[string]interface{}

// Returns a new resulting instance of Fields
// with provided fields concatenated.
func (f Fields) Concat(fields Fields) Fields {
	result := Fields{}
	for key, value := range f {
		result[key] = value
	}
	for key, value := range fields {
		result[key] = value
	}
	return result
}

type OutputFormat string

const (
	JSONFormat OutputFormat = "JSON"
	TextFormat OutputFormat = "TEXT"
)

func (o *OutputFormat) UnmarshalText(text []byte) (err error) {
	values := []OutputFormat{
		JSONFormat,
		TextFormat,
	}

	for _, currentValue := range values {
		if strings.EqualFold(string(text), string(currentValue)) {
			*o = currentValue
			return nil
		}
	}

	return fmt.Errorf("invalid Format value '%s'. Allowed values are %v", text, values)
}

type LogLevel string

const (
	TraceLevel   LogLevel = "TRACE"
	DebugLevel   LogLevel = "DEBUG"
	InfoLevel    LogLevel = "INFO"
	WarningLevel LogLevel = "WARN"
	ErrorLevel   LogLevel = "ERROR"
)

func (o *LogLevel) UnmarshalText(text []byte) (err error) {
	values := []LogLevel{
		TraceLevel,
		DebugLevel,
		InfoLevel,
		WarningLevel,
		ErrorLevel,
	}

	for _, currentValue := range values {
		if strings.EqualFold(string(text), string(currentValue)) {
			*o = currentValue
			return nil
		}
	}

	return fmt.Errorf("invalid Log Level value '%s'. Allowed values are %v", text, values)
}

func (o *LogLevel) Compare(level LogLevel) int {
	a := getLevel(*o)
	b := getLevel(level)
	if a < b {
		return -1
	}
	if a == b {
		return 0
	}
	return 1
}

// for testing.
var _log_printf = log.Printf

// MultiLogf performs a Logf for each non-nil logger with the same format string
// and variadic args
func MultiLogf(loggers []DeprecatedLogger, format string, v ...interface{}) {
	for _, l := range loggers {
		if l != nil {
			l.Logf(format, v...)
		}
	}
}

// DeprecatedLogger logs things, one line at a time. Most implementations send log lines
// to the console.
type DeprecatedLogger interface {
	Logf(msg string, args ...interface{})
}

// Outputter records output that is not sent to the console (e.g. process
// output from deploy tasks).
type Outputter interface {
	Output(msg string)
}

// OutputLogger is a logger with an extra interface that can be used for
// recording output that is not sent to console.
type OutputLogger interface {
	DeprecatedLogger
	Outputter
}

// DiscardOutputLogger for legacy usage.
// TODO: Remove this.
var DiscardOutputLogger = discardOutputLogger{}
