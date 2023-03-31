package util

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"archive/tar"
	"io"
)

type TarWriter interface {
	io.WriteCloser
	WriteHeader(*tar.Header) error
}
