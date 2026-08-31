#!/usr/bin/env python3
"""Read a version's short release note, falling back to recent commit subjects."""
import pathlib
import re
import subprocess
import sys


def summary(version):
    if not re.fullmatch(r'v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)', version):
        raise ValueError('Invalid stable version')
    note = pathlib.Path('release-notes') / (version + '.txt')
    value = note.read_text(encoding='utf-8').strip() if note.exists() else ''
    if not value:
        # Only use commits from this release, never changes from an earlier version.
        previous = subprocess.run(
            ['git', 'describe', '--tags', '--abbrev=0', '--match', 'v[0-9]*', 'HEAD^'],
            capture_output=True, text=True,
        )
        revision = previous.stdout.strip() + '..HEAD' if previous.returncode == 0 else 'HEAD'
        subjects = subprocess.check_output(
            ['git', 'log', '--no-merges', '-3', '--format=%s', revision], text=True,
        ).splitlines()
        value = '；'.join(subjects)
    value = ' '.join(value.split())
    return value[:159] + '…' if len(value) > 160 else value


if __name__ == '__main__':
    print(summary(sys.argv[1]))
