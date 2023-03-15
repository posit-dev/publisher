package rslog

// Copyright (C) 2022 by RStudio, PBC.

import (
	"fmt"
	"io"
)

// A logger that directly sends log statements and output to an io.Writer
type WriterLogger struct {
	Writer io.Writer
}

func NewWriterLogger(writer io.Writer) WriterLogger {
	return WriterLogger{
		Writer: writer,
	}
}

func (logger WriterLogger) Log(msg string) {
	logger.Output(msg)
}
func (logger WriterLogger) Logf(msg string, args ...interface{}) {
	logger.Output(fmt.Sprintf(msg, args...))
}
func (logger WriterLogger) Output(msg string) {
	fmt.Fprint(logger.Writer, msg+"\n")
}
