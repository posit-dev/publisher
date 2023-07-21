package util

import (
	"fmt"
	"io/fs"
	"os"
	"path/filepath"

	"github.com/rstudio/platform-lib/pkg/rslog"
)

type symlinkWalker struct {
	walker Walker
	logger rslog.Logger
}

// NewSymlinkWalker creates a SymlinkWalker, an instance of the
// Walker interface that resolves symlinks before passing info
// to the callback function.
func NewSymlinkWalker(walker Walker, logger rslog.Logger) *symlinkWalker {
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
		if info.Mode().Type()&os.ModeSymlink == os.ModeSymlink {
			w.logger.WithField("path", path).Infof("Following symlink")
			linkTarget, err := filepath.EvalSymlinks(path.Path())
			targetPath := NewPath(linkTarget, path.Fs())
			if err != nil {
				return fmt.Errorf("error following symlink %s: %w", path, err)
			}
			targetInfo, err := targetPath.Stat()
			if err != nil {
				return fmt.Errorf("error getting target info for symlink %s: %w", targetPath, err)
			}
			if targetInfo.IsDir() {
				dirEntries, err := targetPath.ReadDir()
				if err != nil {
					return err
				}
				// Iterate over the directory entries here, constructing
				// a path that goes through the symlink rather than
				// resolving the link and iterating the directory,
				// so that it appears as a descendant of the ignore list root dir.
				for _, entry := range dirEntries {
					subPath := path.Join(entry.Name())
					err = w.Walk(subPath, w.visit(fn))
					if err != nil {
						return err
					}
				}
			} else {
				// Handle all non-directory symlink targets normally
				err = w.visit(fn)(path, targetInfo, nil)
				if err != nil {
					return err
				}
			}
		}
		// Not a symlink. Pass it through to the callback function.
		return fn(path, info, nil)
	}
}
