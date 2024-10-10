package util

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"io/fs"
	"os"
	"path/filepath"

	"github.com/posit-dev/publisher/internal/logging"
)

type symlinkWalker struct {
	walker Walker
	log    logging.Logger
}

// NewSymlinkWalker creates a SymlinkWalker, an instance of the
// Walker interface that resolves symlinks before passing info
// to the callback function.
func NewSymlinkWalker(walker Walker, log logging.Logger) *symlinkWalker {
	return &symlinkWalker{
		walker: walker,
		log:    log,
	}
}

// Walk implements the Walker interface. It walks the underlying
// file structure of the provided walker, following symlinks.
func (w *symlinkWalker) Walk(path AbsolutePath, fn AbsoluteWalkFunc) error {
	return w.walker.Walk(path, w.visit(fn))
}

func (w *symlinkWalker) visit(fn AbsoluteWalkFunc) AbsoluteWalkFunc {
	return func(path AbsolutePath, info fs.FileInfo, err error) error {
		if err != nil {
			return fn(path, nil, err)
		}
		if info.Mode().Type()&os.ModeSymlink != 0 {
			w.log.Info("Following symlink", "path", path)
			linkTarget, err := filepath.EvalSymlinks(path.String())
			if err != nil {
				// There's software that creates symbolic links to files which do not exist,
				// like Emacs which creates symbolic files for unsaved modifications to files.
				// We'll log the behavior but not return errors to not polute the user with error notifications
				// when another piece of software is dealing with the same directory.
				w.log.Warn("Error following symlink, ignoring file", "filepath", path, "error", err.Error())
				return nil
			}

			targetPath := NewPath(linkTarget, path.Fs())
			targetInfo, err := targetPath.Stat()
			if err != nil {
				w.log.Warn("Error getting info for symlink", "filepath", targetPath, "error", err.Error())
				return nil
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
