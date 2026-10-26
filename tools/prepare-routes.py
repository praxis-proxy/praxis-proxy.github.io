#!/usr/bin/env python3
"""Generate original-site redirects using the selected documentation source map."""
import json
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]


def main():
    routes = json.loads((ROOT / 'docs/original-route-mapping.json').read_text())['routes']
    products = json.loads((ROOT / '.cache/docs-data/docs_build_versions.json').read_text())['products']
    sources = json.loads((ROOT / '.cache/docs-data/docs_sources.json').read_text())
    lookup = {(x['product'], x['version'], x['source_path']): x['url'] for x in sources}
    destination = ROOT / '.cache/docs'
    destination.mkdir(parents=True, exist_ok=True)
    assert len(routes) == 40 and len({r['source'] for r in routes}) == 40, 'Expected the complete original URL inventory'
    for number, route in enumerate(routes):
        if route['action'] == 'keep':
            continue
        source = route['source']
        assert source.startswith('/') and '..' not in source.split('/'), source
        target = route['target']
        if route['action'] == 'versioned-page':
            product = route['product']
            target = lookup[(product, products[product]['default'], route['source_path'])]
            if route.get('fragment'):
                target += '#' + route['fragment']
        assert urlsplit(target).scheme in ('', 'https'), target
        metadata = {
            'title': 'Moved documentation', 'url': source, 'layout': 'legacy-redirect',
            'redirect_target': target, 'exclude_search': True,
        }
        frontmatter = '\n'.join(f'{key} = {json.dumps(value)}' for key, value in metadata.items())
        (destination / f'legacy-redirect-{number}.md').write_text('+++\n' + frontmatter + '\n+++\n')
    print(f'Original-site route mapping prepared: {len(routes)} URLs')


if __name__ == '__main__':
    main()
