#!/usr/bin/env python3
"""Fail when hand-written pages name a project release instead of reading it
from the catalog.

Authored pages outlive releases: a literal "Praxis v0.7.2" stays on the site
after the default moves on. Use {{< product-release >}} for the version and
release-linked files. A page whose claims were checked against one release
marks that with {{< release-checked product=... release=... >}}; it may name
that release, and this check reports it once the default moves on. Pages that
describe a pinned source snapshot set `pinned_source = true`.
"""
import json
import re
import sys
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PRODUCTS = {"Praxis AI": "ai", "AI": "ai", "Praxis": "praxis", "Policy": "policy",
            "PPE": "policy", "Grid": "grid"}
MENTION = re.compile(r"\b(Praxis AI|Praxis|AI|Policy|PPE|Grid)\s+(v\d+\.\d+\.\d+)\b")
LINK = re.compile(r"github\.com/praxis-proxy/(praxis|ai|policy|grid)/(?:blob|tree)/(v\d+\.\d+\.\d+)/")
CHECKED = re.compile(r'release-checked\s+product="([a-z]+)"\s+release="([^"]+)"')


def main() -> int:
    catalog = json.loads((ROOT / "data/docs_versions.json").read_text())["products"]
    errors, stale = [], []
    for page in sorted((ROOT / "content").rglob("*.md")):
        rel = page.relative_to(ROOT).as_posix()
        if rel.startswith("content/blog/"):
            continue
        text = page.read_text(encoding="utf-8")
        front = {}
        if text.startswith("+++\n"):
            front = tomllib.loads(text.split("+++\n", 2)[1])
        if front.get("pinned_source"):
            continue
        checked = dict(CHECKED.findall(text))
        for product, release in checked.items():
            if product in catalog and release != catalog[product]["default"]:
                stale.append(f"{rel}: checked against {product} {release}; default is {catalog[product]['default']}")
        found = [(PRODUCTS[name], tag) for name, tag in MENTION.findall(text)] + LINK.findall(text)
        for product, tag in found:
            if checked.get(product) != tag:
                errors.append(f"{rel}: names {product} {tag}; use {{{{< product-release >}}}} or mark the page with release-checked")
    for line in stale:
        print(f"warning: {line}; review the page against the new release")
    for line in errors:
        print(f"error: {line}", file=sys.stderr)
    if errors:
        return 1
    print("Authored version checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
