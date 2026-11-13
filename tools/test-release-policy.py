"""Offline regression checks for documentation release eligibility."""
import io
import json
import unittest
from unittest.mock import patch
import docs


class ReleasePolicyTests(unittest.TestCase):
    def select(self, policy, releases):
        data = {'products': {'ai': {'release_policy': policy}}}
        with patch.object(docs, 'catalog', return_value=data), patch.object(docs, 'repository_url', return_value='https://github.com/praxis-proxy/ai'), patch.object(docs, 'urlopen', return_value=io.StringIO(json.dumps(releases))):
            return docs.latest_release_tag('ai')

    def test_published_includes_alpha_but_never_drafts(self):
        releases = [dict(tag_name='v0.11.0', draft=True), dict(tag_name='v0.10.0', prerelease=True), dict(tag_name='v0.8.0')]
        self.assertEqual(self.select('published', releases), 'v0.10.0')
        self.assertEqual(self.select('stable', releases), 'v0.8.0')

    def test_no_eligible_release(self):
        self.assertIsNone(self.select('stable', [dict(tag_name='v0.10.0', prerelease=True)]))

    def test_stale_default_fails(self):
        data = {'products': {'ai': {'default': 'v0.8.0', 'releases': [dict(default=True, tag='v0.8.0', version='v0.8.0')]}}}
        with patch.object(docs, 'catalog', return_value=data), patch.object(docs, 'latest_release_tag', return_value='v0.10.0'):
            with self.assertRaisesRegex(RuntimeError, 'v0.10.0'):
                docs.check_release_versions()


if __name__ == '__main__':
    unittest.main()
