package rslog

// Copyright (C) 2022 by RStudio, PBC.

import "fmt"

// DeprecatedRecordingLogger is a direct logger that remembers its last Logf call and
// its rendered result. Useful for tests.
type DeprecatedRecordingLogger struct {
	directLogger
	Called  bool
	Format  string
	Args    []interface{}
	Message string
}

// Reset clears any previously recorded state.
func (logger *DeprecatedRecordingLogger) Reset() {
	logger.Called = false
	logger.Format = ""
	logger.Args = nil
	logger.Message = ""
}

func (logger *DeprecatedRecordingLogger) Logf(msg string, args ...interface{}) {
	logger.Called = true
	logger.Format = msg
	logger.Args = args
	logger.Message = fmt.Sprintf(msg, args...)
	logger.directLogger.Logf(msg, args...)
}
