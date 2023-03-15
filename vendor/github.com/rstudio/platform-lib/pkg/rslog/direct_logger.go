package rslog

// Copyright (C) 2022 by RStudio, PBC.

// A logger that directly sends to `log`
type directLogger struct{}

func (logger directLogger) Logf(msg string, args ...interface{}) {
	_log_printf(msg, args...)
}

// DirectLogger for legacy usage.
// TODO: Remove this.
var DirectLogger directLogger = directLogger{}
