//go:build linux || darwin

package updater

import (
	"os"
	"path/filepath"
	"syscall"
)

func Restart() error {
	exe, err := os.Executable()
	if err != nil {
		return err
	}
	exe, err = filepath.EvalSymlinks(exe)
	if err != nil {
		return err
	}
	err = syscall.Exec(exe, os.Args, os.Environ())
	if rollbackErr := os.Rename(exe+".previous", exe); rollbackErr != nil {
		return rollbackErr
	}
	return syscall.Exec(exe, os.Args, os.Environ())
}
