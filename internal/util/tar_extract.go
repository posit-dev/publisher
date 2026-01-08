package util

// Copyright (C) 2026 by Posit Software, PBC.

import (
	"archive/tar"
	"compress/gzip"
	"errors"
	"io"
	"os"
	"path/filepath"
	"strings"
)

func ExtractTarGz(reader io.Reader, dest string) error {
	gzipReader, err := gzip.NewReader(reader)
	if err != nil {
		return err
	}
	defer gzipReader.Close()

	tarReader := tar.NewReader(gzipReader)
	for {
		header, err := tarReader.Next()
		if errors.Is(err, io.EOF) {
			return nil
		}
		if err != nil {
			return err
		}
		cleanName := filepath.Clean(header.Name)
		if filepath.IsAbs(cleanName) ||
			cleanName == ".." ||
			strings.HasPrefix(cleanName, ".."+string(filepath.Separator)) {
			return errors.New("bundle contains invalid path")
		}
		targetPath := filepath.Join(dest, cleanName)
		switch header.Typeflag {
		case tar.TypeDir:
			if err := os.MkdirAll(targetPath, 0o755); err != nil {
				return err
			}
		case tar.TypeReg:
			if err := os.MkdirAll(filepath.Dir(targetPath), 0o755); err != nil {
				return err
			}
			file, err := os.OpenFile(targetPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, os.FileMode(header.Mode))
			if err != nil {
				return err
			}
			if _, err := io.Copy(file, tarReader); err != nil {
				file.Close()
				return err
			}
			if err := file.Close(); err != nil {
				return err
			}
		case tar.TypeSymlink:
			if err := os.MkdirAll(filepath.Dir(targetPath), 0o755); err != nil {
				return err
			}
			linkTarget := filepath.Clean(header.Linkname)
			if filepath.IsAbs(linkTarget) ||
				linkTarget == ".." ||
				strings.HasPrefix(linkTarget, ".."+string(filepath.Separator)) {
				return errors.New("bundle contains invalid symlink")
			}
			if err := os.Symlink(linkTarget, targetPath); err != nil {
				return err
			}
		default:
			return errors.New("bundle contains unsupported entry type")
		}
	}
}
