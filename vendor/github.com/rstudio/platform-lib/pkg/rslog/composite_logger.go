package rslog

// Copyright (C) 2022 by RStudio, PBC.

import "io"

type CompositeLogger struct {
	loggers []Logger
}

var _ Logger = &CompositeLogger{}

func ComposeLoggers(loggers ...Logger) *CompositeLogger {
	return &CompositeLogger{
		loggers: loggers,
	}
}

func (l *CompositeLogger) Logf(msg string, args ...interface{}) {
	for _, logger := range l.loggers {
		logger.Logf(msg, args...)
	}
}

func (l *CompositeLogger) Tracef(msg string, args ...interface{}) {
	for _, logger := range l.loggers {
		logger.Tracef(msg, args...)
	}
}

func (l *CompositeLogger) Debugf(msg string, args ...interface{}) {
	for _, logger := range l.loggers {
		logger.Debugf(msg, args...)
	}
}

func (l *CompositeLogger) Infof(msg string, args ...interface{}) {
	for _, logger := range l.loggers {
		logger.Infof(msg, args...)
	}
}

func (l *CompositeLogger) Warnf(msg string, args ...interface{}) {
	for _, logger := range l.loggers {
		logger.Warnf(msg, args...)
	}
}

func (l *CompositeLogger) Errorf(msg string, args ...interface{}) {
	for _, logger := range l.loggers {
		logger.Errorf(msg, args...)
	}
}

func (l *CompositeLogger) Fatalf(msg string, args ...interface{}) {
	for _, logger := range l.loggers {
		logger.Fatalf(msg, args...)
	}
}

func (l *CompositeLogger) Fatal(args ...interface{}) {
	for _, logger := range l.loggers {
		logger.Fatal(args...)
	}
}

func (l *CompositeLogger) Panicf(msg string, args ...interface{}) {
	for _, logger := range l.loggers {
		logger.Panicf(msg, args...)
	}
}

func (l *CompositeLogger) WithField(key string, value interface{}) Logger {
	newComposite := new(CompositeLogger)

	for _, logger := range l.loggers {
		newLogger := logger.WithField(key, value)
		newComposite.loggers = append(newComposite.loggers, newLogger)
	}
	return newComposite
}

func (l *CompositeLogger) WithFields(fields Fields) Logger {
	newComposite := new(CompositeLogger)

	for _, logger := range l.loggers {
		newLogger := logger.WithFields(fields)
		newComposite.loggers = append(newComposite.loggers, newLogger)
	}
	return newComposite
}

func (l *CompositeLogger) SetLevel(level LogLevel) {
	for _, logger := range l.loggers {
		logger.SetLevel(level)
	}
}

func (l *CompositeLogger) SetOutput(writers ...io.Writer) {
	for _, logger := range l.loggers {
		logger.SetOutput(writers...)
	}
}

func (l *CompositeLogger) SetFormatter(formatter OutputFormat) {
	for _, logger := range l.loggers {
		logger.SetFormatter(formatter)
	}
}
