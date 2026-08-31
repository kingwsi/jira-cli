import hashlib
import json
from pathlib import Path
import tempfile
import unittest

from publish import publish


class PublishTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.target = self.root / 'web'
        self.target.mkdir()
        self.counter = 0

    def stage(self, version='v1.2.3', data=b'archive'):
        self.counter += 1
        root = self.root / str(self.counter)
        release = root / 'releases' / version
        release.mkdir(parents=True)
        (root / 'latest').mkdir()
        name = 'jira-linux-amd64.tar.gz'
        (release / name).write_bytes(data)
        (root / 'latest' / name).write_bytes(data)
        manifest = {'version': version, 'checksums': {name: hashlib.sha256(data).hexdigest()}}
        (root / 'latest/version.json').write_text(json.dumps(manifest))
        (root / 'index.html').write_text(version)
        (root / 'install.sh').write_text('installer')
        return root

    def test_publish_and_retry_keep_history(self):
        publish(self.stage(), self.target)
        publish(self.stage(), self.target)
        publish(self.stage('v1.3.0', b'new'), self.target)
        self.assertEqual(json.loads((self.target / 'latest/version.json').read_text())['version'], 'v1.3.0')
        self.assertEqual((self.target / 'releases/v1.2.3/jira-linux-amd64.tar.gz').read_bytes(), b'archive')
        self.assertEqual((self.target / 'latest/jira-linux-amd64.tar.gz').read_bytes(), b'new')
        self.assertEqual((self.target / 'index.html').stat().st_mode & 0o777, 0o644)

    def test_corruption_leaves_current_publication_unchanged(self):
        publish(self.stage(), self.target)
        stage = self.stage('v1.3.0')
        (stage / 'latest/jira-linux-amd64.tar.gz').write_bytes(b'corrupt')
        with self.assertRaises(ValueError):
            publish(stage, self.target)
        self.assertEqual((self.target / 'index.html').read_text(), 'v1.2.3')
        self.assertFalse((self.target / 'releases/v1.3.0').exists())

    def test_published_version_cannot_be_overwritten(self):
        publish(self.stage(), self.target)
        with self.assertRaises(ValueError):
            publish(self.stage(data=b'different rebuild'), self.target)
        self.assertEqual((self.target / 'latest/jira-linux-amd64.tar.gz').read_bytes(), b'archive')

    def test_older_job_cannot_downgrade_latest(self):
        publish(self.stage('v1.10.0'), self.target)
        with self.assertRaises(ValueError):
            publish(self.stage('v1.9.0'), self.target)
        self.assertEqual((self.target / 'index.html').read_text(), 'v1.10.0')


if __name__ == '__main__':
    unittest.main()
