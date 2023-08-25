package utiltest

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"io"
	"os"
)

func CaptureStderr(fn func()) (string, error) {
	oldStderr := os.Stderr
	stderr, err := os.CreateTemp("", "")
	if err != nil {
		return "", err
	}
	defer stderr.Close()
	defer func() { os.Stderr = oldStderr }()
	os.Stderr = stderr

	fn()

	_, err = stderr.Seek(0, io.SeekStart)
	if err != nil {
		return "", err
	}
	data, err := io.ReadAll(stderr)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

type envVarEntry struct {
	value   string
	present bool
}

type EnvVarHelper struct {
	vars map[string]envVarEntry
}

func (h *EnvVarHelper) Setup(vars ...string) {
	h.vars = map[string]envVarEntry{}
	for _, name := range vars {
		value, ok := os.LookupEnv(name)
		h.vars[name] = envVarEntry{value, ok}
		os.Unsetenv(name)
	}
}

func (h *EnvVarHelper) Teardown() {
	for name, entry := range h.vars {
		if entry.present {
			os.Setenv(name, entry.value)
		} else {
			os.Unsetenv(name)
		}
	}
}
