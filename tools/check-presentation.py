#!/usr/bin/env python3
"""Check generated presentation contracts without external packages."""
import argparse
import gzip
import json
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class Page(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.h1 = 0
        self.redirect = False
        self.canonical = []
        self.task_links = []
        self.robots = []
        self.nav_stack = []
        self.main_links = []
        self.docs_links = []
        self.docs_current = []
        self.search_scope = None
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'nav':
            self.nav_stack.append(attrs.get('aria-label'))
        if 'data-praxis-search' in attrs:
            self.search_scope = (attrs.get('data-praxis-search-default-product'),
                                 attrs.get('data-praxis-search-default-version'))
        if tag == 'meta' and attrs.get('http-equiv', '').lower() == 'refresh':
            self.redirect = True
        if tag == 'a' and self.nav_stack:
            if self.nav_stack[-1] == 'Main navigation':
                self.main_links.append(attrs.get('href'))
            if self.nav_stack[-1] == 'Documentation navigation':
                self.docs_links.append(attrs.get('href'))
                if attrs.get('aria-current') == 'page':
                    self.docs_current.append(attrs.get('href'))
        if tag == 'a' and {'task-card__action', 'project-spotlight__secondary'} & set(attrs.get('class', '').split()):
            self.task_links.append(attrs.get('href'))
        if tag == 'h1':
            self.h1 += 1
        if tag == 'link' and attrs.get('rel') == 'canonical':
            self.canonical.append(attrs.get('href'))
        if tag == 'meta' and attrs.get('name') == 'robots':
            self.robots.append(attrs.get('content'))

    def handle_endtag(self, tag):
        if tag == 'nav' and self.nav_stack:
            self.nav_stack.pop()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--public', type=Path, default=ROOT / 'public')
    public = parser.parse_args().public
    catalog = json.loads((ROOT / 'data/docs_versions.json').read_text())
    defaults = {key: config['default'] for key, config in catalog['products'].items()}
    versions = {key: {r['version'] for r in config['releases']} | {'dev'}
                for key, config in catalog['products'].items()}
    checked = 0
    for path in public.rglob('index.html'):
        text = path.read_text()
        page = Page(text)
        if page.redirect:
            continue
        assert page.h1 == 1, f'{path}: expected one H1, got {page.h1}'
        assert len(page.canonical) == 1, f'{path}: missing/duplicate canonical'
        relative = path.relative_to(public).parts
        archived = (len(relative) > 2 and relative[0] in defaults
                    and relative[1] in versions[relative[0]]
                    and relative[1] != defaults[relative[0]])
        expected = 'noindex, follow' if archived else 'index, follow'
        assert page.robots == [expected], f'{path}: unexpected robots {page.robots}'
        checked += 1
    assert checked > 0, 'Build the website first'
    navigation = json.loads((ROOT / 'data/docs_navigation.json').read_text())
    sources = json.loads((ROOT / '.cache/docs-data/docs_sources.json').read_text())
    expected_tasks = {next(x['url'] for x in sources if x['product'] == product
                           and x['version'] == default
                           and x['source_path'] == navigation['products'][product]['start'])
                      for product, default in defaults.items() if product not in {'praxis', 'ai'}}
    expected_tasks.add('/guides/first-proxy/')
    expected_tasks.add('/ai/container-quickstart/')
    home = Page((public / 'index.html').read_text())
    assert {f'/{product}/{default}/' for product, default in defaults.items()} <= set(home.main_links), \
        'Projects menu must open each selected documentation release'
    assert '/grid/' not in home.main_links, 'Grid project page belongs in Grid documentation navigation'
    grid_docs = Page((public / 'grid' / defaults['grid'] / 'index.html').read_text())
    assert '/grid/' in grid_docs.docs_links, 'Grid documentation must link to its project page'
    assert not {'/docs/', '/start/', '/examples/'} & set(home.main_links), \
        'Docs, Get started, and Examples are project navigation, not top-level links'
    assert '/blog/' in home.main_links, 'Blog must be available in the main navigation'
    blog = Page((public / 'blog/index.html').read_text())
    assert not blog.redirect and blog.h1 == 1, 'Blog index must be a real page with one H1'
    assert '/blog/' in blog.main_links, 'Blog navigation must remain available on the index'
    post = Page((public / 'blog/welcome/index.html').read_text())
    assert not post.redirect and post.h1 == 1, 'Retained welcome post must have one H1'
    assert Page((public / 'community/welcome/index.html').read_text()).redirect, \
        'Old community summary route must redirect to the blog post'
    guide = Page((public / 'guides/use-filters/index.html').read_text())
    assert guide.docs_current == ['/guides/use-filters/'], 'Guide must have one current sidebar link'
    assert guide.search_scope == ('praxis', defaults['praxis']), 'Guide search must use selected Praxis docs'
    assert f'/praxis/{defaults["praxis"]}/examples/' in guide.docs_links, \
        'Guide sidebar must expose the selected Praxis example catalog'
    capabilities = Page((public / 'praxis/capabilities/index.html').read_text())
    assert capabilities.docs_current == ['/praxis/capabilities/'], \
        'Capability reference must have one current sidebar link'
    config_url = next(x['url'] for x in sources if x['product'] == 'praxis'
                      and x['version'] == defaults['praxis']
                      and x['source_path'] == 'docs/operating/configuration.md')
    config = Page((public / config_url.strip('/') / 'index.html').read_text())
    assert config.docs_current == [config_url], 'Imported docs must keep exact current sidebar state'
    assert '/guides/use-filters/' in config.docs_links, 'Imported docs must link back to Praxis guides'
    for route in ('index.html', 'start/index.html'):
        page = Page((public / route).read_text())
        assert set(page.task_links) == expected_tasks, f'{route}: missing task starting guide'
    for route in ('start', 'docs', 'search', 'community', 'examples', 'visual-guides',
                  'ai/container-quickstart',
                  'guides/install', 'guides/first-proxy', 'guides/operate', 'guides/extend'):
        assert (public / route / 'index.html').is_file(), f'Missing /{route}/'
    custom = list((public / 'js').glob('praxis*.js')) + list((public / 'js').glob('flow-walkthrough*.js'))
    assert custom, 'Missing website interaction bundle'
    size = sum(len(gzip.compress(p.read_bytes())) for p in custom)
    assert size <= 20 * 1024, f'Custom JavaScript budget exceeded: {size} bytes gzip'
    print(f'Presentation checks passed: {checked} pages; custom JavaScript {size} bytes gzip')


if __name__ == '__main__':
    main()
