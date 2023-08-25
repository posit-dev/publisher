package util

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"fmt"
	"io/fs"
	"log/slog"
	"os"
	"path/filepath"
)

type symlinkWalker struct {
	walker Walker
	logger *slog.Logger
}

// NewSymlinkWalker creates a SymlinkWalker, an instance of the
// Walker interface that resolves symlinks before passing info
// to the callback function.
func NewSymlinkWalker(walker Walker, logger *slog.Logger) *symlinkWalker {
	return &symlinkWalker{
		walker: walker,
		logger: logger,
	}
}

// Walk implements the Walker interface. It walks the underlying
// file structure of the provided walker, following symlinks.
func (w *symlinkWalker) Walk(path Path, fn WalkFunc) error {
	return w.walker.Walk(path, w.visit(fn))
}

func (w *symlinkWalker) visit(fn WalkFunc) WalkFunc {
	return func(path Path, info fs.FileInfo, err error) error {
		if err != nil {
			// Stop walking the tree on errors.
			return err
		}
		if info.Mode().Type()&os.ModeSymlink != 0 {
			w.logger.Info("Following symlink", "path", path)
			linkTarget, err := filepath.EvalSymlinks(path.Path())
			targetPath := NewPath(linkTarget, path.Fs())
			if err != nil {
				return fmt.Errorf("error following symlink %s: %w", path, err)
			}
			targetInfo, err := targetPath.Stat()
			if err != nil {
				return fmt.Errorf("error getting target info for symlink %s: %w", targetPath, err)
			}
			// Visit symlink target info but use the path to the link.
			err = w.visit(fn)(path, targetInfo, nil)
			if err != nil {
				return err
			}
			if targetInfo.IsDir() {
				dirEntries, err := targetPath.ReadDir()
				if err != nil {
					return err
				}
				// Iterate over the directory entries here, constructing
				// a path that goes through the symlink rather than
				// resolving the link and iterating the directory,
				// so that it appears as a descendant of the root dir.
				for _, entry := range dirEntries {
					subPath := path.Join(entry.Name())
					err = w.Walk(subPath, w.visit(fn))
					if err != nil {
						return err
					}
				}
			}
			return nil
		} else {
			// Not a symlink. Pass it through to the callback function.
			return fn(path, info, nil)
		}
	}
}
