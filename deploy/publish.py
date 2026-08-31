#!/usr/bin/env python3
"""Validate staged release files and publish on the Nginx host (POSIX)."""
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import sys
import tempfile


def publish(stage, target):
    stage, target = Path(stage), Path(target)
    with (target / '.publish.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        manifest = json.loads((stage / 'latest/version.json').read_text())
        version = manifest['version']
        if not re.fullmatch(r'v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)', version):
            raise ValueError('Invalid stable version')
        checksums = manifest['checksums']
        if not checksums:
            raise ValueError('Missing checksums')
        release = stage / 'releases' / version
        for name, digest in checksums.items():
            if not re.fullmatch(r'jira-(darwin|linux|windows)-(amd64|arm64)\.tar\.gz', name):
                raise ValueError('Invalid archive name')
            for source in (release / name, stage / 'latest' / name):
                if source.is_symlink() or hashlib.sha256(source.read_bytes()).hexdigest() != digest:
                    raise ValueError('Archive checksum mismatch: ' + name)
        for name in ('index.html', 'install.sh'):
            if not (stage / name).is_file():
                raise ValueError('Missing ' + name)
        latest = target / 'latest'
        if (latest / 'version.json').exists():
            current = json.loads((latest / 'version.json').read_text())['version']
            if tuple(map(int, current.lstrip('v').split('.'))) > tuple(map(int, version[1:].split('.'))):
                raise ValueError('Refusing to replace a newer published version')
        releases = target / 'releases'
        releases.mkdir(exist_ok=True)
        destination = releases / version
        if destination.exists():
            # A retry is safe only when all immutable archives are unchanged.
            for name, digest in checksums.items():
                if hashlib.sha256((destination / name).read_bytes()).hexdigest() != digest:
                    raise ValueError('Refusing to overwrite published version: ' + version)
        else:
            # stage and target are on the same filesystem.
            os.rename(release, destination)
        latest.mkdir(exist_ok=True)

        def replace(source, destination):
            fd, temporary = tempfile.mkstemp(prefix='.publish-', dir=destination.parent)
            try:
                with os.fdopen(fd, 'wb') as output, source.open('rb') as input_file:
                    shutil.copyfileobj(input_file, output)
                    output.flush()
                    os.fsync(output.fileno())
                    os.fchmod(output.fileno(), 0o644)
                os.replace(temporary, destination)
            finally:
                if os.path.exists(temporary):
                    os.unlink(temporary)

        for name in checksums:
            replace(destination / name, latest / name)
        for name in ('index.html', 'install.sh'):
            replace(stage / name, target / name)
        # This is the commit point for the updater: immutable packages exist first.
        replace(stage / 'latest/version.json', latest / 'version.json')
        print('Published ' + version)


if __name__ == '__main__':
    publish(sys.argv[1], sys.argv[2])
