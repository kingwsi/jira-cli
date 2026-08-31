import hashlib
import io
import os
from pathlib import Path
import subprocess
import tarfile
import tempfile
import unittest


class InstallTest(unittest.TestCase):
    def run_install(self, system='Linux', valid=True):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            mock = root / 'bin'
            mock.mkdir()
            package = root / 'package.tar.gz'
            with tarfile.open(package, 'w:gz') as archive:
                info = tarfile.TarInfo('jira')
                info.size = 6
                info.mode = 0o755
                archive.addfile(info, io.BytesIO(b'binary'))
            digest = hashlib.sha256(package.read_bytes()).hexdigest() if valid else '0' * 64
            template = Path(__file__).with_name('install.sh').read_text()
            script = template.replace('__VERSION__', 'v1.0.2').replace(
                '__CHECKSUM_CASES__', f'  jira-linux-amd64.tar.gz) expected="{digest}" ;;')
            path = root / 'install.sh'
            path.write_text(script)
            commands = {
                'uname': 'if [ "$1" = "-s" ]; then printf "%s\\n" "$MOCK_OS"; else echo x86_64; fi',
                'curl': 'printf "%s\\n" "$2" > "$TRACE_URL"; cp "$FIXTURE_PACKAGE" "$4"',
                'id': 'echo 1000',
                # Never invoke sudo or write into the real /usr/local/bin.
                'sudo': 'printf "%s\\n" "$*" >> "$TRACE_INSTALL"',
            }
            for name, body in commands.items():
                command = mock / name
                command.write_text('#!/bin/sh\nset -eu\n' + body + '\n')
                command.chmod(0o755)
            env = dict(os.environ, PATH=str(mock) + os.pathsep + os.environ['PATH'],
                       MOCK_OS=system, TRACE_URL=str(root / 'url'),
                       FIXTURE_PACKAGE=str(package), TRACE_INSTALL=str(root / 'installed'))
            subprocess.run(['bash', '-n', str(path)], check=True)
            result = subprocess.run(['bash', str(path)], env=env, capture_output=True, text=True)
            url = (root / 'url').read_text().strip() if (root / 'url').exists() else ''
            installed = (root / 'installed').exists()
            return result, url, installed

    def test_versioned_download_and_install(self):
        result, url, installed = self.run_install()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(url, 'https://nextx.uk/jira-work/releases/v1.0.2/jira-linux-amd64.tar.gz')
        self.assertTrue(installed)

    def test_checksum_failure_never_installs(self):
        result, _, installed = self.run_install(valid=False)
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(installed)
        self.assertIn('校验失败', result.stderr)

    def test_windows_rejected_before_download(self):
        result, url, installed = self.run_install(system='MINGW64_NT-10.0')
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(url, '')
        self.assertFalse(installed)
        self.assertIn('Windows', result.stderr)
