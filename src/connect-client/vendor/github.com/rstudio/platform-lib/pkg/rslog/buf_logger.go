package rslog

// Copyright (C) 2022 by RStudio, PBC.

import "sync"

type BufLogEntry struct {
	Level   LogLevel
	Message string
	Args    []interface{}
	Logger  CoreLoggerImpl
}

type BufStorage struct {
	mu      sync.Mutex
	entries []BufLogEntry
}

func (s *BufStorage) add(entry BufLogEntry) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.entries = append(s.entries, entry)
}

func (s *BufStorage) read(f func(BufLogEntry)) {
	s.mu.Lock()
	defer s.mu.Unlock()

	for _, e := range s.entries {
		f(e)
	}
}

type BufLogger struct {
	CoreLogger CoreLoggerImpl
	storage    *BufStorage
	flush      func()
}

var _ CoreLoggerImpl = new(BufLogger)

func NewBufLogger(coreLogger CoreLoggerImpl, flush func()) *BufLogger {
	return &BufLogger{
		storage: &BufStorage{
			entries: make([]BufLogEntry, 0),
		},
		CoreLogger: coreLogger,
		flush:      flush,
	}
}

func (buf *BufLogger) Tracef(msg string, args ...interface{}) {
	buf.storage.add(BufLogEntry{
		Level:   TraceLevel,
		Message: msg,
		Args:    args,
		Logger:  buf.CoreLogger,
	})
}

func (buf *BufLogger) Debugf(msg string, args ...interface{}) {
	buf.storage.add(BufLogEntry{
		Level:   DebugLevel,
		Message: msg,
		Args:    args,
		Logger:  buf.CoreLogger,
	})
}

func (buf *BufLogger) Infof(msg string, args ...interface{}) {
	buf.storage.add(BufLogEntry{
		Level:   InfoLevel,
		Message: msg,
		Args:    args,
		Logger:  buf.CoreLogger,
	})
}

func (buf *BufLogger) Warnf(msg string, args ...interface{}) {
	buf.storage.add(BufLogEntry{
		Level:   WarningLevel,
		Message: msg,
		Args:    args,
		Logger:  buf.CoreLogger,
	})
}
func (buf *BufLogger) Errorf(msg string, args ...interface{}) {
	buf.storage.add(BufLogEntry{
		Level:   ErrorLevel,
		Message: msg,
		Args:    args,
		Logger:  buf.CoreLogger,
	})
}

func (buf *BufLogger) Fatal(args ...interface{}) {
	buf.flush()
	buf.CoreLogger.Fatal(args...)
}

func (buf *BufLogger) Fatalf(msg string, args ...interface{}) {
	buf.flush()
	buf.CoreLogger.Fatalf(msg, args...)
}

func (buf *BufLogger) Panicf(msg string, args ...interface{}) {
	buf.flush()
	buf.CoreLogger.Panicf(msg, args...)
}

func (buf *BufLogger) Read(f func(BufLogEntry)) {
	buf.storage.read(f)
	buf.storage = nil
}

// child creates and registers a wrapped logger implementation and returns a new buffered logger
// that will pass down the same storage and fallback fields for its children, if any.
func (buf *BufLogger) child(coreLogger CoreLoggerImpl) *BufLogger {
	return &BufLogger{
		CoreLogger: coreLogger,
		storage:    buf.storage,
	}
}
