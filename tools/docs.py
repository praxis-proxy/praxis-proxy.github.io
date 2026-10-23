#!/usr/bin/env python3
"""Acquire and adapt the pinned product documentation for Hugo."""

from __future__ import annotations

import argparse
import functools
import html
import json
import os
import re
import shutil
import subprocess
import tarfile
import tempfile
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from urllib.error import HTTPError, URLError
from urllib.parse import quote, unquote, urlsplit, urlunsplit
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / "sources"
CACHE = ROOT / ".cache"
DOCS_OUT = CACHE / "docs"
DATA_OUT = CACHE / "docs-data"
STATIC_OUT = CACHE / "docs-static"
CATALOG = ROOT / "data" / "docs_versions.json"
NAVIGATION = ROOT / "data" / "docs_navigation.json"
EXAMPLE_METADATA = ROOT / "data" / "example_metadata.json"
COVERAGE_REPORT = ROOT / "docs" / "example-coverage-report.md"
RELEASE_TAG = re.compile(r"v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?\Z")
GIT_REF = re.compile(r"[A-Za-z0-9][A-Za-z0-9._/-]*\Z")
GIT_SHA = re.compile(r"[0-9a-fA-F]{40}\Z")
LINK = re.compile(r"(?P<start>!?\[[^\]]*\]\()(?P<url><[^>]+>|[^\s)]+)(?P<end>[^)]*\))")
REFERENCE_DEFINITION = re.compile(
    r"(?m)^(?P<prefix>[ \t]{0,3}\[(?:\\.|[^\]])+\]:[ \t]*)"
    r"(?P<url><[^>\r\n]+>|[^\s]+)(?P<suffix>[^\r\n]*)(?P<newline>\r?\n|$)"
)
HTML_LINK = re.compile(r"(?P<attr>\b(?:href|src)=['\"])(?P<url>[^'\"]+)(?P<end>['\"])", re.I)
HTML_ELEMENT = re.compile(r"<[A-Za-z][A-Za-z0-9:-]*\b[^<>]*>", re.S)
HEADING = re.compile(r"^#\s+(.+?)\s*#*\s*$", re.M)
INLINE_LINK = re.compile(r"!?\[([^\]]*)\]\([^)]*\)|!?\[([^\]]*)\]\[[^]]*\]")
HTML_TAG = re.compile(r"<[^>]*>")
ARTICLE_NEEDS = ("How-to", "Tutorial", "Reference", "Explanation")
OTHER_NEEDS = ("Overview", "Release")
EXAMPLE_SUFFIXES = {".yaml", ".yml", ".json", ".toml", ".conf", ".ini", ".xml", ".sh", ".py", ".rs"}
EXAMPLE_RESOURCE = re.compile(r"(?<![A-Za-z0-9_])(?:[A-Za-z0-9_./+-]+\.(?:json|ya?ml|pem|crt|key|der|p12|pfx|txt|proto|bin))(?![A-Za-z0-9_])", re.I)
INTEGRATION_MARKERS = re.compile(
    r"(?:anthropic|openai|azure|vertex|gcp|aws|postgres|nemo|lakera|llm.?d|llmisvc|vllm|"
    r"otlp|grpc|mcp|a2a|web.?search|vector.?store|mtls|tls|certificate|credential|"
    r"external|database|cloud|agentic|guardrail|provider)", re.I,
)
_EXAMPLE_METADATA_CACHE: dict | None = None


@dataclass
class ExampleContext:
    product: str
    version: str
    label: str
    sha: str
    config: dict
    repo: Path
    descriptions: dict[str, str]
    known_paths: set[str]
    assets: Path
    working: bool
    source_status: str
    edit_branch: str


def run(args: list[str], *, cwd: Path = ROOT, capture: bool = False) -> str:
    result = subprocess.run(
        args, cwd=cwd, text=True, stdout=subprocess.PIPE if capture else None,
        stderr=subprocess.PIPE if capture else None, check=False,
    )
    if result.returncode:
        detail = result.stderr.strip() if capture and result.stderr else ""
        raise RuntimeError(f"command failed ({result.returncode}): {' '.join(args)}{': ' + detail if detail else ''}")
    return result.stdout.strip() if capture and result.stdout else ""


@functools.lru_cache(maxsize=1)
def catalog() -> dict:
    data = json.loads(CATALOG.read_text(encoding="utf-8"))
    for product, config in data["products"].items():
        releases = config["releases"]
        versions = [release["version"] for release in releases]
        tags = [release["tag"] for release in releases]
        if len(versions) != len(set(versions)) or len(tags) != len(set(tags)):
            raise RuntimeError(f"{product} catalog contains duplicate versions or tags")
        if sum(release["default"] for release in releases) != 1:
            raise RuntimeError(f"{product} catalog must mark exactly one release as default")
        default = next(release for release in releases if release["default"])
        if config["default"] != default["version"]:
            raise RuntimeError(f"{product} default does not match its marked release")
        for release in releases:
            if not RELEASE_TAG.fullmatch(release["tag"]) or not GIT_SHA.fullmatch(release["sha"]):
                raise RuntimeError(f"{product} {release['version']} must have a release tag and full commit SHA")
        development = config.get("development")
        if development and development.get("sha"):
            if not development.get("ref"):
                raise RuntimeError(f"{product} development tracking must name a ref")
            if not GIT_SHA.fullmatch(development["sha"]):
                raise RuntimeError(f"{product} development must record a full commit SHA")
        exclude = config.get("exclude", [])
        if not isinstance(exclude, list) or not all(isinstance(entry, str) for entry in exclude):
            raise RuntimeError(f"{product} exclude must be a list of source paths")
        for required in config["required"]:
            if excluded_path(required, exclude):
                raise RuntimeError(f"{product} excludes a required docs path: {required}")
    return data


def git(repo: Path, *args: str) -> str:
    return run(["git", "-C", str(repo), *args], capture=True)


def repository_url(product: str) -> str:
    url = run(["git", "config", "--file", str(ROOT / ".gitmodules"), "--get",
               f"submodule.sources/{product}.url"], capture=True)
    return url.removesuffix(".git")


def pointer(product: str) -> str:
    output = run(["git", "ls-files", "-s", "--", f"sources/{product}"], capture=True)
    for line in output.splitlines():
        fields = line.split()
        if len(fields) >= 4 and fields[0] == "160000":
            return fields[1]
    raise RuntimeError(f"sources/{product} is not recorded as a Git submodule in the index")


def source_state(product: str) -> tuple[str, str, str]:
    repo = SOURCES / product
    commit = git(repo, "rev-parse", "HEAD")
    status = git(repo, "status", "--porcelain=v1", "--untracked-files=all")
    branch = git(repo, "branch", "--show-current")
    return commit, status, branch


def check_catalog_objects(*, fetch: bool) -> None:
    data = catalog()["products"]
    for product, config in data.items():
        repo = SOURCES / product
        missing = [
            release["tag"]
            for release in config["releases"]
            if subprocess.run(
                ["git", "-C", str(repo), "rev-parse", "--verify", f"refs/tags/{release['tag']}^{{commit}}"],
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            ).returncode != 0
        ]
        development = config.get("development")
        dev_sha = development["sha"] if development and development.get("sha") else None
        dev_missing = bool(dev_sha) and subprocess.run(
            ["git", "-C", str(repo), "rev-parse", "--verify", f"{dev_sha}^{{commit}}"],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        ).returncode != 0
        if (missing or dev_missing) and not fetch:
            targets = list(missing) + ([f"development {dev_sha}"] if dev_missing else [])
            raise RuntimeError(f"missing {product} source object(s) {', '.join(targets)}; run make init")
        if missing or dev_missing:
            # Fetch every missing object in one call. A per-object loop rewrites
            # the shallow submodule's .git/shallow on each iteration, and the
            # next fetch aborts with "shallow file has changed since we read it";
            # a single fetch writes that file once.
            run(["git", "-C", str(repo), "fetch", "--no-tags", "--depth=1", "origin",
                 *(f"refs/tags/{tag}:refs/tags/{tag}" for tag in missing),
                 *([dev_sha] if dev_missing else [])])
        for release in config["releases"]:
            tag = release["tag"]
            actual = git(repo, "rev-parse", f"{tag}^{{commit}}")
            if actual != release["sha"]:
                raise RuntimeError(f"{product} {tag} resolved to {actual}, catalog records {release['sha']}")


def latest_release_tag(product: str) -> str | None:
    parsed = urlsplit(repository_url(product))
    if parsed.hostname != "github.com":
        raise RuntimeError(f"{product} release checks require a GitHub source repository")
    owner, separator, repo = parsed.path.strip("/").partition("/")
    if not separator or not owner or not repo:
        raise RuntimeError(f"could not read the GitHub repository for {product}: {parsed.geturl()}")
    endpoint = "https://api.github.com/repos/{}/{}/releases".format(
        quote(owner, safe=""), quote(repo.removesuffix(".git"), safe="")
    )
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "praxis-website-docs",
        "X-GitHub-Api-Version": "2026-03-10",
    }
    token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"
    page = 1
    while True:
        request = Request(f"{endpoint}?per_page=100&page={page}", headers=headers)
        try:
            with urlopen(request, timeout=20) as response:
                releases = json.load(response)
        except HTTPError as error:
            raise RuntimeError(f"GitHub release lookup failed for {product} (HTTP {error.code})") from error
        except (URLError, TimeoutError, json.JSONDecodeError, UnicodeDecodeError) as error:
            raise RuntimeError(f"GitHub release lookup failed for {product}: {error}") from error
        if not isinstance(releases, list):
            raise RuntimeError(f"GitHub returned an invalid release list for {product}")
        for release in releases:
            if not isinstance(release, dict) or release.get("draft") or release.get("prerelease"):
                continue
            tag = release.get("tag_name")
            if not isinstance(tag, str) or not RELEASE_TAG.fullmatch(tag):
                raise RuntimeError(f"GitHub returned an invalid latest release tag for {product}: {tag!r}")
            return tag
        if len(releases) < 100:
            return None
        page += 1


def check_release_versions() -> None:
    products = catalog()["products"]
    failures: list[str] = []
    for product, config in products.items():
        try:
            latest = latest_release_tag(product)
        except RuntimeError as error:
            failures.append(str(error))
            continue
        if latest is None:
            current = next(release for release in config["releases"] if release["default"])
            print(f"{product}: no published stable release; keeping docs default {current['tag']}.")
            continue
        current = next(release for release in config["releases"] if release["default"])
        if current["tag"] != latest or current["version"] != latest or config["default"] != latest:
            failures.append(
                f"{product}: docs default is {current['version']} ({current['tag']}), but GitHub's latest published stable release is {latest}; "
                "run `make update-doc-versions` and review the catalog and source pointers"
            )
        else:
            print(f"{product}: docs default {current['tag']} matches the latest published release.")
    if failures:
        raise RuntimeError("\n".join(failures))


def update_doc_versions() -> None:
    data = catalog()
    products = data["products"]
    updates: dict[str, tuple[str, str, Path]] = {}
    skipped: list[str] = []

    for product, config in products.items():
        repo = SOURCES / product
        if not (repo / ".git").exists():
            raise RuntimeError(f"{product} source is not initialized; run `make init` first")
        if git(repo, "status", "--porcelain=v1", "--untracked-files=all"):
            raise RuntimeError(f"{product} source checkout is dirty; preserve or commit its changes before updating")
        tag = latest_release_tag(product)
        if tag is None:
            current = next(release for release in config["releases"] if release["default"])
            skipped.append(f"{product}: no published stable release; kept {current['tag']}")
            continue
        run(["git", "-C", str(repo), "fetch", "--no-tags", "--depth=1", "origin", f"refs/tags/{tag}:refs/tags/{tag}"])
        sha = git(repo, "rev-parse", f"{tag}^{{commit}}")
        existing = next((release for release in config["releases"] if release["tag"] == tag), None)
        if existing and existing["sha"] != sha:
            raise RuntimeError(f"{product} {tag} resolves to {sha}, catalog records {existing['sha']}")
        if existing and existing["version"] != tag:
            raise RuntimeError(f"{product} catalog maps {tag} to version {existing['version']}; review that mapping manually")
        for required in config["required"]:
            result = subprocess.run(
                ["git", "-C", str(repo), "cat-file", "-e", f"{sha}:{required}"],
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            )
            if result.returncode:
                raise RuntimeError(f"{product} {tag} is missing required docs path {required}")
        updates[product] = (tag, sha, repo)

    changed: list[str] = []
    for product, (tag, sha, repo) in updates.items():
        config = products[product]
        current = next(release for release in config["releases"] if release["default"])
        source_was_current = git(repo, "rev-parse", "HEAD") == sha
        release = next((item for item in config["releases"] if item["tag"] == tag), None)
        if release is None:
            suffix = ""
            if current["label"].startswith(current["version"]):
                suffix = current["label"][len(current["version"]):]
            release = {"version": tag, "label": tag + suffix, "tag": tag, "sha": sha, "default": False}
            config["releases"].append(release)
        config["default"] = release["version"]
        for item in config["releases"]:
            item["default"] = item["tag"] == tag
        config["releases"].sort(key=lambda item: item["tag"] != tag)
        if not source_was_current:
            run(["git", "-C", str(repo), "checkout", "--detach", sha])
        if current["tag"] != tag:
            changed.append(f"{product}: {current['tag']} -> {tag} ({sha})")
        elif not source_was_current:
            changed.append(f"{product}: source pointer -> {tag} ({sha})")

    CATALOG.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    catalog.cache_clear()
    if changed:
        print("Updated documentation versions:\n" + "\n".join(changed))
    elif not skipped:
        print("Documentation defaults already match the latest published releases.")
    if skipped:
        print("Skipped projects without a published stable release:\n" + "\n".join(skipped))


def init() -> None:
    for product in catalog()["products"]:
        path = SOURCES / product
        if not (path / ".git").exists():
            run(["git", "submodule", "update", "--init", "--depth", "1", "--", f"sources/{product}"])
    check_catalog_objects(fetch=True)
    print("Source submodules and cataloged release objects are ready.")


def excluded_path(rel: str, exclude: list[str]) -> bool:
    """Match an exclude entry: an exact path or a `dir/**` subtree."""
    for pattern in exclude:
        if pattern.endswith("/**"):
            root = pattern[:-3]
            if rel == root or rel.startswith(root + "/"):
                return True
        elif rel == pattern:
            return True
    return False


def selected_files(repo: Path, config: dict) -> list[Path]:
    # Every Markdown file under the content root is published unless it is
    # listed in `exclude`, so new upstream pages appear with no catalog edit.
    content_root = repo / config["content_root"]
    exclude = config.get("exclude", [])
    chosen: set[Path] = set()
    if content_root.is_dir():
        for path in content_root.rglob("*.md"):
            if path.is_file() and not excluded_path(path.relative_to(repo).as_posix(), exclude):
                chosen.add(path)
    for required in config["required"]:
        if not (repo / required).is_file():
            raise RuntimeError(f"required {required} is missing from {repo.name} snapshot")
    return sorted(chosen)


def archived_source(repo: Path, sha: str, config: dict, destination: Path) -> None:
    roots = [config["content_root"]]
    paths = [path for path in roots if subprocess.run(
        ["git", "-C", str(repo), "cat-file", "-e", f"{sha}:{path}"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    ).returncode == 0]
    archive = subprocess.run(
        ["git", "-C", str(repo), "archive", "--format=tar", sha, "--", *paths],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False,
    )
    if archive.returncode:
        raise RuntimeError(archive.stderr.decode("utf-8", "replace").strip())
    destination.mkdir(parents=True, exist_ok=True)
    root = destination.resolve()
    with tarfile.open(fileobj=__import__("io").BytesIO(archive.stdout), mode="r:") as bundle:
        for member in bundle.getmembers():
            target = (destination / member.name).resolve()
            if root not in target.parents and target != root:
                raise RuntimeError(f"unsafe path in Git archive: {member.name}")
            if member.isdir():
                target.mkdir(parents=True, exist_ok=True)
            elif member.isfile():
                target.parent.mkdir(parents=True, exist_ok=True)
                source = bundle.extractfile(member)
                if source is not None:
                    target.write_bytes(source.read())


def site_url(product: str, version: str, output_path: str) -> str:
    path = PurePosixPath(output_path)
    if path.name == "_index.md":
        relative = path.parent.as_posix()
        suffix = "" if relative == "." else relative + "/"
    else:
        suffix = path.with_suffix("").as_posix() + "/"
    return f"/{product}/{version}/{suffix}"


def normalized_repo_path(source_path: str, href_path: str) -> str | None:
    if href_path.startswith("/"):
        return None
    path = PurePosixPath(source_path).parent.joinpath(PurePosixPath(href_path))
    parts: list[str] = []
    for part in path.parts:
        if part in ("", "."):
            continue
        if part == "..":
            if not parts:
                return None
            parts.pop()
        else:
            parts.append(part)
    return "/".join(parts)


def read_blob(repo: Path, sha: str, rel: str, *, working: bool) -> bytes | None:
    path = repo / rel
    if working and path.is_file():
        return path.read_bytes()
    result = subprocess.run(
        ["git", "-C", str(repo), "show", f"{sha}:{rel}"],
        stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, check=False,
    )
    return result.stdout if result.returncode == 0 else None


def repo_paths(repo: Path, sha: str, *, working: bool) -> set[str]:
    paths = set(git(repo, "ls-tree", "-r", "--name-only", sha).splitlines())
    if working:
        paths.update(git(repo, "ls-files", "--cached", "--others", "--exclude-standard").splitlines())
    return paths


def markdown_links(text: str):
    """Yield Markdown and HTML link targets outside code, comments, and escaped links."""
    chunk: list[str] = []
    fence: str | None = None
    fence_length = 0

    def targets(value: str):
        masked, _ = _protect_non_markdown(value)
        for match in REFERENCE_DEFINITION.finditer(masked):
            yield match.group("url").strip("<>")
        for match in LINK.finditer(masked):
            if not _is_escaped(masked, match.start("start")):
                yield match.group("url").strip("<>")
        for element in HTML_ELEMENT.finditer(masked):
            for match in HTML_LINK.finditer(element.group(0)):
                yield match.group("url")

    for line in text.splitlines(keepends=True):
        marker = re.match(r"^\s*(`{3,}|~{3,})", line)
        if marker:
            token = marker.group(1)[0]
            if fence is None:
                yield from targets("".join(chunk))
                chunk.clear()
                fence = token
                fence_length = len(marker.group(1))
            elif token == fence and len(marker.group(1)) >= fence_length:
                fence = None
                fence_length = 0
            continue
        if fence is None:
            chunk.append(line)
    yield from targets("".join(chunk))


def linked_examples(source_files: list[Path], source_root: Path, *, repo: Path, sha: str,
                    working: bool, known_paths: set[str]) -> tuple[dict[str, bytes], set[str], dict[str, str]]:
    """Load only textual examples linked by selected Markdown pages."""
    paths: set[str] = set()
    directories: set[str] = set()
    for source_file in source_files:
        if source_file.suffix.lower() != ".md":
            continue
        source_path = source_file.relative_to(source_root).as_posix()
        for raw in markdown_links(source_file.read_text(encoding="utf-8")):
            parts = urlsplit(raw)
            if parts.scheme or parts.netloc or not parts.path:
                continue
            target = normalized_repo_path(source_path, unquote(parts.path))
            if not target or not target.startswith("examples/"):
                continue
            if target == "examples/README.md" and target in known_paths:
                paths.add(target)
            elif PurePosixPath(target).suffix.lower() in EXAMPLE_SUFFIXES and target in known_paths:
                paths.add(target)
            elif not PurePosixPath(target).suffix and any(
                path.startswith(target.rstrip("/") + "/") for path in known_paths
            ):
                directories.add(target.rstrip("/"))

    examples: dict[str, bytes] = {}
    for path in sorted(paths):
        body = read_blob(repo, sha, path, working=working)
        if body is None:
            continue
        try:
            value = body.decode("utf-8")
        except UnicodeDecodeError:
            continue
        if "\0" not in value:
            examples[path] = body

    descriptions: dict[str, str] = {}
    readme = read_blob(repo, sha, "examples/README.md", working=working)
    if readme is not None:
        for line in readme.decode("utf-8", "replace").splitlines():
            match = re.match(r"^\s*\|\s*\[[^]]+\]\(([^)]+)\)\s*\|\s*(.*?)\s*\|\s*$", line)
            if match:
                target = normalized_repo_path("examples/README.md", match.group(1))
                if target and target.startswith("examples/"):
                    descriptions[target] = plain_text(match.group(2))
    return examples, directories, descriptions


def example_content_path(source_path: str) -> str:
    return "examples/_index.md" if source_path == "examples/README.md" else source_path + ".md"


def tracked_example_configs(repo: Path, sha: str, *, working: bool) -> dict[str, bytes]:
    paths = set(git(repo, "ls-tree", "-r", "--name-only", sha).splitlines())
    if working:
        paths.update(git(repo, "ls-files", "--cached").splitlines())
    examples = {}
    for path in sorted(paths):
        if not path.startswith("examples/") or PurePosixPath(path).suffix.lower() not in {".yaml", ".yml"}:
            continue
        body = read_blob(repo, sha, path, working=working)
        if body is not None:
            examples[path] = body
    return examples


def example_config_groups(configs: dict[str, bytes]) -> set[str]:
    groups = {"examples/configs"}
    for path in configs:
        parent = PurePosixPath(path).parent
        while parent.as_posix().startswith("examples/configs"):
            groups.add(parent.as_posix())
            if parent.as_posix() == "examples/configs":
                break
            parent = parent.parent
    return groups if configs else set()


def example_source_mapping(examples: dict[str, bytes], directories: set[str]) -> dict[str, str]:
    mapping = {path: example_content_path(path) for path in examples}
    if not examples and not directories:
        return mapping
    mapping.update({"examples": "examples/_index.md", "examples/README.md": "examples/_index.md"})
    configs = {path: body for path, body in examples.items()
               if path.startswith("examples/configs/") and PurePosixPath(path).suffix.lower() in {".yaml", ".yml"}}
    groups = example_config_groups(configs)
    mapping.update({group: f"{group}/_index.md" for group in groups})
    mapping.update({directory: mapping.get(directory, "examples/_index.md") for directory in directories})
    return mapping


def copy_extra_assets(context: ExampleContext) -> None:
    for source_path in context.config.get("extra_assets", []):
        path = PurePosixPath(source_path)
        if path.is_absolute() or ".." in path.parts:
            raise RuntimeError(f"unsafe extra asset path for {context.config['name']}: {source_path}")
        body = read_blob(context.repo, context.sha, source_path, working=context.working)
        if body is None:
            raise RuntimeError(f"configured {context.config['name']} extra asset is missing at {context.sha}: {source_path}")
        destination = context.assets / context.product / context.version / "_assets" / source_path
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(body)


def example_metadata(product: str, source_path: str, content: bytes, descriptions: dict[str, str]) -> dict:
    global _EXAMPLE_METADATA_CACHE
    if _EXAMPLE_METADATA_CACHE is None:
        _EXAMPLE_METADATA_CACHE = json.loads(EXAMPLE_METADATA.read_text(encoding="utf-8"))
    product_meta = _EXAMPLE_METADATA_CACHE.get(product, {})
    authored = product_meta.get(source_path, {})
    text = content.decode("utf-8", "replace")
    title = PurePosixPath(source_path).stem.replace("-", " ").replace("_", " ").title()
    group = PurePosixPath(source_path).parent.relative_to("examples/configs").as_posix()
    summary = authored.get("summary") or descriptions.get(source_path) or f"{title} configuration for {group.replace('-', ' ')}."
    if len(summary) < 20:
        summary = f"{summary} Configuration example for {product}."
    category = authored.get("category")
    if category not in {"practical", "integration", "fixture"}:
        category = "fixture" if "fixture" in PurePosixPath(source_path).stem.lower() else (
            "integration" if INTEGRATION_MARKERS.search(source_path + " " + summary + " " + text) else "practical"
        )
    task = authored.get("task") or summary
    prerequisites = authored.get("prerequisites")
    if prerequisites is None:
        prerequisites = (
            ["The matching test or replay fixture; this is not a standalone deployment configuration."]
            if category == "fixture" else
            ["The external service, credentials, or certificates referenced by this configuration."]
            if category == "integration" else
            ["The product runtime and any backend services referenced by this configuration."]
        )
    outcome = authored.get("outcome")
    search_terms = list(dict.fromkeys([task, summary, group, *prerequisites]))
    # Curated showcase rank: position of this path in the product's metadata
    # key sequence. Drives featured-example ordering; unauthored paths sort last.
    featured_order = list(product_meta).index(source_path) if source_path in product_meta else len(product_meta)
    return {
        "title": title, "summary": summary, "task": task, "group": group,
        "category": category, "prerequisites": prerequisites, "outcome": outcome,
        "featured": bool(authored.get("featured")), "featured_order": featured_order,
        "search_terms": search_terms,
    }


def example_resources(content: bytes, source_path: str, known_paths: set[str]) -> set[str]:
    resources = set()
    for match in EXAMPLE_RESOURCE.finditer(content.decode("utf-8", "replace")):
        candidate = match.group(0).strip("`'\" :;()[]{}").rstrip(".,")
        if candidate.startswith(("/", "http://", "https://")):
            continue
        resolved = normalized_repo_path(source_path, candidate)
        for path in (resolved, candidate):
            if path in known_paths and path != source_path:
                resources.add(path)
    return resources


def example_page_description(context: ExampleContext, source_path: str, content: bytes,
                             details: dict | None) -> tuple[str, str, str, set[str]]:
    if details:
        classification = {"practical": "Practical", "integration": "Setup-dependent integration", "fixture": "Test fixture"}[details["category"]]
        intro = f"**Category:** {classification}  \n**Task:** {details['task']}\n"
        if details["prerequisites"]:
            intro += "\n**Prerequisites:** " + "; ".join(details["prerequisites"]) + "\n"
        if details["outcome"]:
            intro += f"\n**Expected outcome:** {details['outcome']}\n"
        if context.product in {"praxis", "ai"} and context.version != "dev" and not example_requires_custom_build(content):
            quickstart_href = "/guides/first-proxy/" if context.product == "praxis" else "/ai/container-quickstart/"
            quickstart_label = "first reverse-proxy tutorial" if context.product == "praxis" else "container quickstart"
            image_tag = next(release["tag"] for release in context.config["releases"]
                             if release["version"] == context.version).removeprefix("v")
            image = f"ghcr.io/praxis-proxy/{context.product}:{image_tag}"
            intro += f"\n**Run it:** Use `{image}` and follow the [{quickstart_label}]({quickstart_href}) to mount and start the configuration.\n"
        intro += "\nThis configuration comes from the selected release. The example has not been run here; external services are not bundled.\n"
        return details["title"], details["summary"], intro, example_resources(content, source_path, context.known_paths)
    title = PurePosixPath(source_path).stem.replace("-", " ").replace("_", " ").title()
    summary = context.descriptions.get(source_path) or (
        f"Source example file {source_path.removeprefix('examples/')} from the "
        f"{context.config['name']} {context.version} snapshot."
    )
    if len(summary) < 20:
        summary = f"{summary} Example source for {context.config['name']}."
    return title, summary, "This file is copied from the selected source snapshot.\n", set()


def example_requires_custom_build(content: bytes) -> bool:
    text = content.decode("utf-8", "replace")
    return bool(re.search(r"--features\b|compile[- ]time", text, re.I))


def hide_default_build_commands(text: str) -> str:
    lines = text.splitlines()
    result = []
    index = 0
    while index < len(lines):
        if lines[index].strip().lower() == "# usage:":
            end = index + 1
            while end < len(lines) and lines[end].strip():
                end += 1
            block = lines[index:end]
            if any(re.search(r"\bcargo (?:run|build)\b", line) for line in block):
                index = end + (end < len(lines))
                continue
        if re.search(r"^\s*#.*\bcargo (?:run|build)\b", lines[index]):
            continuation = lines[index].rstrip().endswith("\\")
            index += 1
            while continuation and index < len(lines) and re.match(r"^\s*#\s{2,}\S", lines[index]):
                continuation = lines[index].rstrip().endswith("\\")
                index += 1
            continue
        result.append(lines[index])
        index += 1
    return "\n".join(result) + ("\n" if text.endswith("\n") else "")


def copy_example_companions(context: ExampleContext, source_path: str, resources: set[str]) -> list[str]:
    links = []
    for companion in sorted(resources):
        body = read_blob(context.repo, context.sha, companion, working=context.working)
        if body is None:
            continue
        destination = context.assets / context.product / context.version / "_assets" / companion
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(body)
        links.append(f"- [{PurePosixPath(companion).name}](/{context.product}/{context.version}/_assets/{companion})")
    return links


def example_page_body(source_path: str, content: bytes, intro: str,
                      download: str, companion_links: list[str], *, show_container: bool) -> str:
    text = content.decode("utf-8", "replace")
    if show_container:
        text = hide_default_build_commands(text)
    fence_length = max((len(match.group(0)) for match in re.finditer(r"`+", text)), default=2) + 1
    fence = "`" * max(3, fence_length)
    body = intro + f"\nDownload the [source file]({download})."
    if companion_links:
        body += "\n\nCompanion resources from the same snapshot:\n\n" + "\n".join(companion_links)
    body += f"\n\n{fence}{PurePosixPath(source_path).suffix.removeprefix('.')}\n{text}"
    return body + ("" if text.endswith("\n") else "\n") + f"{fence}\n"


def example_page_frontmatter(context: ExampleContext, source_path: str, output_path: str,
                             order: int, title: str, summary: str, details: dict | None) -> dict:
    product, version, label, sha, config = (
        context.product, context.version, context.label, context.sha, context.config,
    )
    metadata = {
        "title": title, "product": product, "version": version, "version_label": label,
        "source_commit": sha, "source_repo": config["repo"], "source_path": source_path,
        "issue_url": config["issues"], "version_archive": version != "dev" and version != config["default"],
        "github_repo": config["repo"], "github_branch": sha, "github_project_repo": config["repo"],
        "github_subdir": "", "path_base_for_github_subdir": {
            "from": "^" + re.escape(f".cache/docs/{product}/{version}/{output_path}") + "$",
            "to": source_path,
        },
        "description": summary, "summary": summary, "reader_need": "Reference", "topic": "Examples",
        "order": order, "preview_dirty": bool(context.source_status),
    }
    if details:
        metadata.update({
            "example_category": details["category"], "example_task": details["task"],
            "example_group": details["group"], "example_prerequisites": details["prerequisites"],
            "example_outcome": details["outcome"], "example_featured": details["featured"],
            "example_order": details["featured_order"], "example_search": details["search_terms"],
        })
    if version == "dev" and context.edit_branch:
        metadata["edit_url"] = f"{config['repo']}/edit/{context.edit_branch}/{source_path}"
    if version == config["default"]:
        metadata["aliases"] = [site_url(product, "latest", output_path)]
    return metadata


def write_example_page(context: ExampleContext, source_path: str, content: bytes,
                       output_path: str, order: int, details: dict | None) -> dict:
    product, version = context.product, context.version
    title, summary, intro, resources = example_page_description(
        context, source_path, content, details,
    )
    download_path = f"{product}/{version}/_assets/{source_path}"
    download_file = context.assets / download_path
    download_file.parent.mkdir(parents=True, exist_ok=True)
    download_file.write_bytes(content)
    companions = copy_example_companions(context, source_path, resources)
    page_body = example_page_body(
        source_path, content, intro, f"/{download_path}", companions,
        show_container=(context.product in {"praxis", "ai"} and context.version != "dev"
                        and not example_requires_custom_build(content)),
    )
    metadata = example_page_frontmatter(context, source_path, output_path, order, title, summary, details)
    destination = DOCS_OUT / product / version / output_path
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(
        frontmatter(metadata) + "{{< docs-version >}}\n\n" + page_body + "\n{{< docs-source-links >}}\n",
        encoding="utf-8",
    )
    return {"product": product, "version": version, "source_path": source_path,
            "content_path": output_path, "source_commit": context.sha,
            "url": site_url(product, version, output_path), "dirty": bool(context.source_status)}


def example_index_metadata(context: ExampleContext, page: dict) -> dict:
    product, version, label, config = context.product, context.version, context.label, context.config
    metadata = {
        "title": page["title"], "product": product, "version": version, "version_label": label,
        "source_commit": context.sha, "source_repo": config["repo"], "source_path": page["source_path"],
        "issue_url": config["issues"], "version_archive": version != "dev" and version != config["default"],
        "description": page["description"], "summary": page["summary"], "reader_need": "Overview",
        "topic": "Examples", "order": page["order"],
    }
    if version == config["default"]:
        metadata["aliases"] = [site_url(product, "latest", page["content_path"])]
    return metadata


def write_example_index(context: ExampleContext, page: dict, metadata: dict, lines: list[str]) -> dict:
    output_path = page["content_path"]
    destination = DOCS_OUT / context.product / context.version / output_path
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(frontmatter(metadata) + "{{< docs-version >}}\n\n" + "\n".join(lines) + "\n",
                           encoding="utf-8")
    return {"product": context.product, "version": context.version, "source_path": page["source_path"],
            "content_path": output_path, "source_commit": context.sha,
            "url": site_url(context.product, context.version, output_path),
            "dirty": bool(context.source_status)}


def write_example_catalog_index(context: ExampleContext, samples: list[tuple[str, bytes]],
                                configs: dict[str, bytes], output_paths: dict[str, str],
                                group_pages: dict[str, str]) -> dict:
    product, version, label, sha, config = (
        context.product, context.version, context.label, context.sha, context.config,
    )
    descriptions = context.descriptions
    index_source = "examples/README.md" if "examples/README.md" in context.known_paths else "examples"
    featured = sorted(
        (item for item in configs.items()
         if example_metadata(product, item[0], item[1], descriptions)["featured"]),
        key=lambda item: example_metadata(product, item[0], item[1], descriptions)["featured_order"],
    )
    other_samples = [(path, body) for path, body in samples if path not in configs]
    categories = sorted({PurePosixPath(path).relative_to("examples/configs").parts[0] for path in configs
                         if PurePosixPath(path).parent.as_posix() != "examples/configs"})
    lines = [
        (f"Browse {len(configs)} tracked YAML configurations from the {label} {config['name']} source snapshot."
         if configs else f"Browse {len(other_samples)} linked source examples from the {label} {config['name']} snapshot."),
        "Pages and downloads keep the selected version and source commit. Examples may need local services, credentials, or certificates; their presence here does not imply they were run.",
        "", "## Start with these tasks", "",
    ]
    for path, body in featured:
        details = example_metadata(product, path, body, descriptions)
        lines.append(f"- [{details['task']}]({site_url(product, version, output_paths[path])}) — {details['summary']}")
    if not featured:
        lines.append("Choose a category below to browse every published YAML configuration." if configs
                     else "Browse the linked source examples below.")
    if configs:
        lines.extend(["", "## Browse all configurations", ""])
    elif other_samples:
        lines.extend(["", "## Linked source examples", ""])
    if configs:
        lines.append(f"- [All configuration categories]({site_url(product, version, group_pages['examples/configs'])})")
        for category in categories:
            group = f"examples/configs/{category}"
            title = category.replace("-", " ").replace("_", " ").title()
            lines.append(f"- [{title}]({site_url(product, version, group_pages[group])})")
    if other_samples:
        if configs:
            lines.extend(["", "## Other linked source examples", ""])
        lines.extend(
            f"- [{PurePosixPath(path).relative_to('examples').as_posix()}]("
            f"{site_url(product, version, output_paths[path])})" for path, _ in other_samples
        )
    summary = (f"Browse {len(configs)} tracked YAML configurations for {config['name']}, organized by task and setup needs."
               if configs else f"Browse {len(other_samples)} linked source examples for {config['name']}, with pages pinned to the selected source snapshot.")
    page = {"title": "Examples", "source_path": index_source, "content_path": "examples/_index.md",
            "description": summary, "summary": summary, "order": 20}
    metadata = example_index_metadata(context, page)
    metadata.update({"example_catalog": True, "example_count": len(configs)})
    return write_example_index(context, page, metadata, lines)


def write_example_category_indexes(context: ExampleContext, configs: dict[str, bytes],
                                   output_paths: dict[str, str], group_pages: dict[str, str]) -> list[dict]:
    product, version, config = context.product, context.version, context.config
    descriptions = context.descriptions
    output = []
    for group in sorted(group_pages):
        group_files = [(path, body) for path, body in sorted(configs.items())
                       if PurePosixPath(path).parent.as_posix() == group]
        children = sorted(child for child in group_pages
                          if PurePosixPath(child).parent.as_posix() == group)
        title = "All configurations" if group == "examples/configs" else PurePosixPath(group).name.replace("-", " ").replace("_", " ").title()
        lines = [f"Configurations in {title if group != 'examples/configs' else config['name']}.", ""]
        if children:
            lines.extend(["## Subcategories", ""])
            for child in children:
                child_title = PurePosixPath(child).name.replace("-", " ").replace("_", " ").title()
                lines.append(f"- [{child_title}]({site_url(product, version, group_pages[child])})")
            lines.append("")
        if group_files:
            lines.extend(["## Configurations", ""])
            for path, body in group_files:
                details = example_metadata(product, path, body, descriptions)
                lines.append(f"- [{details['title']}]({site_url(product, version, output_paths[path])}) — {details['summary']}")
        category = "configurations" if group == "examples/configs" else PurePosixPath(group).name
        output_path = group_pages[group]
        description = f"{len(group_files)} configurations in {title} for {config['name']}."
        summary = f"{len(group_files)} version-pinned configuration pages."
        page = {"title": title, "source_path": group, "content_path": output_path,
                "description": description, "summary": summary, "order": 21}
        metadata = example_index_metadata(context, page)
        metadata["example_catalog_category"] = category
        output.append(write_example_index(context, page, metadata, lines))
    return output


def write_example_pages(context: ExampleContext, examples: dict[str, bytes], directories: set[str]) -> list[dict]:
    if not examples and not directories:
        return []
    product = context.product
    readme_path = "examples/README.md"
    samples = [(path, content) for path, content in sorted(examples.items()) if path != readme_path]
    configs = {path: body for path, body in samples
               if path.startswith("examples/configs/") and PurePosixPath(path).suffix.lower() in {".yaml", ".yml"}}
    group_pages = {group: f"{group}/_index.md" for group in example_config_groups(configs)}
    output_paths = example_source_mapping(examples, directories)
    output_paths.update(group_pages)
    output = [
        write_example_page(context, path, body, output_paths[path], order,
                           example_metadata(product, path, body, context.descriptions) if path in configs else None)
        for order, (path, body) in enumerate(samples, start=1000)
    ]
    output.append(write_example_catalog_index(
        context, samples, configs, output_paths, group_pages,
    ))
    output.extend(write_example_category_indexes(
        context, configs, output_paths, group_pages,
    ))
    return output


def check_curated_example_paths() -> None:
    curated = json.loads(EXAMPLE_METADATA.read_text(encoding="utf-8"))
    products = catalog()["products"]
    for product, entries in curated.items():
        config = products[product]
        release = next(item for item in config["releases"] if item["version"] == config["default"])
        known = repo_paths(SOURCES / product, release["sha"], working=False)
        missing = set(entries) - known
        assert not missing, f"curated {product} examples are absent from {release['version']}: {sorted(missing)}"
    tls = example_metadata(
        "praxis", "examples/configs/protocols/tls-termination.yaml", b"", {},
    )
    assert tls["featured"] and any("does not include" in item for item in tls["prerequisites"])


def map_product_doc(config: dict, source_path: str) -> str | None:
    content_root = config["content_root"]
    under_root = source_path == content_root or source_path.startswith(content_root + "/")
    if not source_path.endswith(".md") or not under_root:
        return None
    if excluded_path(source_path, config.get("exclude", [])):
        return None
    relative = PurePosixPath(source_path).relative_to(PurePosixPath(content_root))
    if source_path in config.get("indexes", []):
        return (relative.parent / "_index.md").as_posix()
    return relative.as_posix()


@functools.lru_cache(maxsize=None)
def blob_exists(product: str, sha: str, path: str) -> bool:
    """Whether a path exists in a product source tree at a commit (memoized)."""
    return subprocess.run(
        ["git", "-C", str(SOURCES / product), "cat-file", "-e", f"{sha}:{path}"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    ).returncode == 0


def rewrite_cross_product(raw: str) -> str:
    parts = urlsplit(raw)
    if parts.netloc.lower() != "github.com":
        return raw
    fields = parts.path.strip("/").split("/")
    if len(fields) < 5 or fields[0] != "praxis-proxy" or fields[2] != "blob":
        return raw
    products = catalog()["products"]
    product = fields[1]
    if product not in products:
        return raw
    config = products[product]
    ref = fields[3]
    release = next((release for release in config["releases"] if release["version"] == ref), None)
    development = config.get("development")
    if release:
        version, sha = release["version"], release["sha"]
    elif development and ref == development["ref"]:
        version, sha = "dev", development["sha"]
    else:
        return raw
    source_rel = "/".join(fields[4:])
    mapped = map_product_doc(config, source_rel)
    if mapped is None:
        return raw
    # Only rewrite to an internal URL when the target page is actually published
    # at that version; otherwise keep the upstream link (e.g. a page that exists
    # on a branch but not in the selected release).
    if not blob_exists(product, sha, source_rel):
        return raw
    return urlunsplit(("", "", site_url(product, version, mapped), parts.query, parts.fragment))


def rewrite_target(raw_url: str, *, image: bool, product: str, version: str, config: dict,
                   repo: Path, sha: str, source_path: str, selected: dict[str, str],
                   assets: Path, working: bool, known_paths: set[str]) -> str:
    wrapped = raw_url.startswith("<") and raw_url.endswith(">")
    raw = raw_url[1:-1] if wrapped else raw_url
    parts = urlsplit(raw)
    if parts.scheme or parts.netloc:
        rewritten = rewrite_cross_product(raw)
        return f"<{rewritten}>" if wrapped else rewritten
    if not parts.path or parts.path.startswith("/"):
        return raw_url
    target = normalized_repo_path(source_path, unquote(parts.path))
    if target is None:
        return raw_url
    if not image and target in selected:
        new = site_url(product, version, selected[target])
        return urlunsplit(("", "", new, parts.query, parts.fragment))
    if image and target in known_paths:
        body = read_blob(repo, sha, target, working=working)
        if body is not None:
            output = assets / product / version / "_assets" / target
            output.parent.mkdir(parents=True, exist_ok=True)
            output.write_bytes(body)
            new = f"/{product}/{version}/_assets/{target}"
            return urlunsplit(("", "", new, parts.query, parts.fragment))
    is_directory = target.endswith("/") or any(path.startswith(target.rstrip("/") + "/") for path in known_paths)
    ref_type = "tree" if is_directory else "blob"
    source_url = f"{config['repo']}/{ref_type}/{sha}/{quote(target, safe='/')}"
    return urlunsplit(("", "", source_url, parts.query, parts.fragment))


def _is_escaped(text: str, position: int) -> bool:
    slashes = 0
    position -= 1
    while position >= 0 and text[position] == "\\":
        slashes += 1
        position -= 1
    return slashes % 2 == 1


def _protect_non_markdown(text: str) -> tuple[str, dict[str, str]]:
    """Mask inline code and HTML comments while rewriting links in Markdown text."""
    masked: list[str] = []
    protected: dict[str, str] = {}
    cursor = 0

    def mask(value: str) -> str:
        token = f"\x00DOCS-LITERAL-{len(protected)}\x00"
        protected[token] = value
        return token

    while cursor < len(text):
        comment_start = text.find("<!--", cursor)
        tick_start = text.find("`", cursor)
        while tick_start >= 0 and _is_escaped(text, tick_start):
            tick_start = text.find("`", tick_start + 1)
        if comment_start < 0 and tick_start < 0:
            masked.append(text[cursor:])
            break

        if comment_start >= 0 and (tick_start < 0 or comment_start < tick_start):
            comment_end = text.find("-->", comment_start + 4)
            end = len(text) if comment_end < 0 else comment_end + 3
            masked.extend((text[cursor:comment_start], mask(text[comment_start:end])))
            cursor = end
            continue

        masked.append(text[cursor:tick_start])
        run_end = tick_start + 1
        while run_end < len(text) and text[run_end] == "`":
            run_end += 1
        delimiter_length = run_end - tick_start
        search = run_end
        close_start = -1
        close_end = -1
        while search < len(text):
            candidate = text.find("`", search)
            if candidate < 0:
                break
            candidate_end = candidate + 1
            while candidate_end < len(text) and text[candidate_end] == "`":
                candidate_end += 1
            if candidate_end - candidate == delimiter_length:
                close_start, close_end = candidate, candidate_end
                break
            search = candidate_end
        if close_start < 0:
            masked.append(text[tick_start:run_end])
            cursor = run_end
            continue
        masked.append(mask(text[tick_start:close_end]))
        cursor = close_end

    return "".join(masked), protected


def _rewrite_markdown_chunk(text: str, **context) -> str:
    masked, protected = _protect_non_markdown(text)

    def replace_reference(match: re.Match) -> str:
        url = match.group("url")
        rewritten = rewrite_target(url, image=False, **context)
        return match.group("prefix") + rewritten + match.group("suffix") + match.group("newline")

    masked = REFERENCE_DEFINITION.sub(replace_reference, masked)

    def replace_link(match: re.Match) -> str:
        start = match.start("start")
        if _is_escaped(masked, start):
            return match.group(0)
        raw = match.group("url")
        target = raw[1:-1] if raw.startswith("<") and raw.endswith(">") else raw
        is_image = match.group("start").startswith("!")
        rewritten = rewrite_target(target, image=is_image, **context)
        wrapped = f"<{rewritten}>" if raw.startswith("<") and raw.endswith(">") else rewritten
        return match.group("start") + wrapped + match.group("end")

    masked = LINK.sub(replace_link, masked)

    def replace_html(match: re.Match) -> str:
        is_image = match.group("attr").lower().startswith("src")
        rewritten = rewrite_target(match.group("url"), image=is_image, **context)
        return match.group("attr") + rewritten + match.group("end")

    def replace_html_element(match: re.Match) -> str:
        return HTML_LINK.sub(replace_html, match.group(0))

    masked = HTML_ELEMENT.sub(replace_html_element, masked)
    for token, literal in protected.items():
        masked = masked.replace(token, literal)
    return masked


def rewrite_markdown(text: str, **context) -> str:
    output: list[str] = []
    markdown_chunk: list[str] = []
    fence: str | None = None
    fence_length = 0

    def flush_markdown() -> None:
        if markdown_chunk:
            output.append(_rewrite_markdown_chunk("".join(markdown_chunk), **context))
            markdown_chunk.clear()

    for line in text.splitlines(keepends=True):
        marker = re.match(r"^\s*(`{3,}|~{3,})", line)
        if marker:
            token = marker.group(1)[0]
            if fence is None:
                flush_markdown()
                fence = token
                fence_length = len(marker.group(1))
                output.append(line)
            elif token == fence:
                output.append(line)
                if len(marker.group(1)) >= fence_length:
                    fence = None
                    fence_length = 0
            else:
                output.append(line)
            continue
        if fence is not None:
            output.append(line)
            continue
        markdown_chunk.append(line)
    flush_markdown()
    return "".join(output)


def demote_subsequent_h1s(markdown: str) -> str:
    lines: list[str] = []
    fence: str | None = None
    fence_length = 0
    seen_h1 = False
    for line in markdown.splitlines(keepends=True):
        marker = re.match(r"^ {0,3}(`{3,}|~{3,})", line)
        if marker:
            token = marker.group(1)[0]
            if fence is None:
                fence, fence_length = token, len(marker.group(1))
            elif token == fence and len(marker.group(1)) >= fence_length:
                fence, fence_length = None, 0
            lines.append(line)
        elif fence is None and (heading := re.match(r"^( {0,3})(#{1,6})(?=[ \t])", line)):
            level = len(heading.group(2))
            if level == 1 and not seen_h1:
                seen_h1 = True
            elif seen_h1 and level < 6:
                # Shift later headings one level down so nested headings stay
                # beneath the section they belong to.
                line = heading.group(1) + "#" + line[len(heading.group(1)):]
            lines.append(line)
        else:
            lines.append(line)
    return "".join(lines)


def adapt_page_markdown(text: str, title: str, **context) -> str:
    """Apply source adaptation and remove the body H1 duplicated by page metadata."""
    if context.get("product") == "grid" and context.get("source_path") == "docs/routing.md":
        text = demote_subsequent_h1s(text)
    return remove_duplicate_initial_h1(rewrite_markdown(text, **context), title)


def quote_toml(value: str) -> str:
    return json.dumps(value, ensure_ascii=False)


def toml_literal(value) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, int):
        return str(value)
    if isinstance(value, list):
        return "[" + ", ".join(quote_toml(str(item)) for item in value) + "]"
    return quote_toml(str(value))


def add_example_frontmatter(lines: list[str], values: dict) -> None:
    for key, value in values.items():
        if key.startswith("example_") and value is not None:
            lines.append(f"{key} = {toml_literal(value)}")


def frontmatter(values: dict) -> str:
    lines = ["+++", f"title = {quote_toml(values['title'])}", 'type = "docs"']
    for key in ("weight", "order", "product", "version", "version_label", "source_commit", "source_repo",
                "source_path", "issue_url", "reader_need", "topic", "summary", "edit_url", "github_repo",
                "github_branch", "github_subdir", "github_project_repo", "description"):
        if key in values and values[key] is not None:
            value = values[key]
            if isinstance(value, int):
                lines.append(f"{key} = {value}")
            else:
                lines.append(f"{key} = {quote_toml(str(value))}")
    for key in ("version_archive", "preview_dirty"):
        if key in values:
            lines.append(f"{key} = {'true' if values[key] else 'false'}")
    add_example_frontmatter(lines, values)
    if values.get("aliases"):
        lines.append("aliases = [" + ", ".join(quote_toml(value) for value in values["aliases"]) + "]")
    if "related_sourcepaths" in values:
        lines.append("related_sourcepaths = [" + ", ".join(quote_toml(value) for value in values["related_sourcepaths"]) + "]")
    if isinstance(values.get("path_base_for_github_subdir"), dict):
        lines.extend(["", "[path_base_for_github_subdir]"])
        for key, value in values["path_base_for_github_subdir"].items():
            lines.append(f"{key} = {quote_toml(value)}")
    elif values.get("path_base_for_github_subdir"):
        lines.append(f"path_base_for_github_subdir = {quote_toml(values['path_base_for_github_subdir'])}")
    if isinstance(values.get("cascade"), dict):
        lines.extend(["", "[cascade]"])
        for key, value in values["cascade"].items():
            lines.append(f"{key} = {'true' if value else 'false'}" if isinstance(value, bool)
                         else f"{key} = {quote_toml(str(value))}")
    lines.extend(["+++", ""])
    return "\n".join(lines)


def title_for(path: Path, text: str) -> str:
    match = HEADING.search(text)
    if match:
        return heading_text(match.group(1))
    if path.name == "_index.md":
        return "Documentation"
    return path.stem.replace("_", " ").replace("-", " ").title()


def plain_text(markdown: str) -> str:
    markdown = INLINE_LINK.sub(lambda match: match.group(1) or match.group(2) or "", markdown)
    markdown = re.sub(r"`([^`]*)`", r"\1", markdown)
    markdown = re.sub(r"[*~]", "", markdown)
    markdown = re.sub(r"(?<!\w)_(.*?)_(?!\w)", r"\1", markdown)
    markdown = HTML_TAG.sub("", markdown)
    return re.sub(r"\s+", " ", html.unescape(markdown)).strip()


def heading_text(markdown: str) -> str:
    markdown = INLINE_LINK.sub(lambda match: match.group(1) or match.group(2) or "", markdown)
    markdown = re.sub(r"`([^`]*)`", r"\1", markdown)
    markdown = re.sub(r"\s+\{#[^}]+\}\s*$", "", markdown)
    markdown = re.sub(r"[*~]", "", markdown)
    markdown = HTML_TAG.sub("", markdown)
    return re.sub(r"\s+", " ", html.unescape(markdown)).strip()


def slugify_heading(value: str) -> str:
    slug = []
    for char in heading_text(value).lower():
        if char.isalnum() or char in "-_":
            slug.append(char)
        elif char.isspace():
            slug.append("-")
    return "".join(slug)


def remove_duplicate_initial_h1(markdown: str, title: str) -> str:
    lines = markdown.splitlines(keepends=True)
    index = 0
    while index < len(lines):
        line = lines[index].strip()
        if not line:
            index += 1
        elif line.startswith("<!--"):
            while index < len(lines) and "-->" not in lines[index]:
                index += 1
            index += 1
        elif re.fullmatch(r"<a\s+(?:id|name)=[\"'][^\"']+[\"'][^>]*>\s*</a>", line, re.I):
            index += 1
        elif re.fullmatch(r"<img\b[^>]*?/?>", line, re.I):
            index += 1
        elif re.fullmatch(r"(?:\[)?!\[[^\]]*\]\([^)]*\)(?:\]\([^)]*\))?", line):
            index += 1
        else:
            break
    if index == len(lines):
        return markdown
    match = HEADING.fullmatch(lines[index].rstrip("\r\n"))
    if not match:
        return markdown
    heading = match.group(1).strip()
    explicit = re.search(r"\s+\{#([^}\s]+)\}\s*$", heading)
    comparable = heading[:explicit.start()].strip() if explicit else heading
    if heading_text(comparable).casefold() != heading_text(title).casefold():
        return markdown
    inline_anchor = re.search(r"<a\s+(?:id|name)=[\"']([^\"']+)[\"'][^>]*>\s*</a>", comparable, re.I)
    if explicit or inline_anchor:
        anchor = explicit.group(1) if explicit else inline_anchor.group(1)
        lines[index] = f'<a id="{anchor}"></a>\n'
    elif not any(re.search(r"(?:id|name)=[\"']", line, re.I) for line in lines[:index]):
        lines[index] = f'<a id="{slugify_heading(comparable)}"></a>\n'
    else:
        lines[index] = ""
    return "".join(lines)


def summarize(markdown: str) -> str:
    in_fence = False
    paragraphs: list[list[str]] = []
    current: list[str] = []
    for line in markdown.splitlines():
        if re.match(r"^\s*(`{3,}|~{3,})", line):
            in_fence = not in_fence
            continue
        if in_fence:
            continue
        if not line.strip():
            if current:
                paragraphs.append(current)
                current = []
            continue
        if line.lstrip().startswith(("#", "<!--", "{{<", "|", ">", "[", "<")) or re.match(r"^\s*[-*+]\s", line):
            if current:
                paragraphs.append(current)
                current = []
            continue
        current.append(line.strip())
    if current:
        paragraphs.append(current)
    for paragraph in paragraphs:
        value = plain_text(" ".join(paragraph))
        if len(value) < 20:
            continue
        if len(value) > 200:
            sentence = re.match(r"^(.{40,200}?[.!?])(?:\s|$)", value)
            value = sentence.group(1) if sentence else value[:197].rsplit(" ", 1)[0].rstrip(".,;:") + "…"
        return value
    return ""


def fallback_need(product: str, source_path: str) -> str:
    path = PurePosixPath(source_path)
    stem = path.stem
    parts = path.parts
    if stem == "release":
        return "Release"
    if stem in {"README", "index"}:
        return "Overview"
    if "architecture" in parts or stem in {"branch-chains", "extensions", "overview", "vision", "threat-model", "pipeline", "cmf", "cmf-extensions"}:
        return "Explanation"
    if "filters" in parts:
        if stem in {"reference"} or stem not in {"README", "extensions"}:
            return "Reference"
        return "Explanation" if stem == "extensions" else "Overview"
    if stem == "quickstart":
        return "Tutorial" if product == "policy" else "How-to"
    if "operating" in parts or "developing" in parts:
        return "How-to"
    return "Reference"


def fallback_topic(source_path: str) -> str:
    path = PurePosixPath(source_path)
    parts = [part for part in path.parts[1:-1] if part not in {"content"}]
    if parts:
        return " ".join(part.replace("_", " ").replace("-", " ").title() for part in parts)
    return "Core Concepts"


def fallback_summary(product: str, source_path: str) -> str:
    path = PurePosixPath(source_path)
    stem = path.stem
    title = path.parent.name if stem in {"README", "index", "_index"} else stem
    title = title.replace("_", " ").replace("-", " ").strip() or product
    return f"Documentation for {title} in the {product} project."


def page_metadata(product: str, source_path: str, original: str, navigation: dict) -> dict:
    product_navigation = navigation.get("products", {}).get(product, {})
    override = product_navigation.get("articles", {}).get(source_path, {})
    need = override.get("reader_need", fallback_need(product, source_path))
    if need not in (*ARTICLE_NEEDS, *OTHER_NEEDS):
        raise RuntimeError(f"invalid reader_need {need!r} for {product}:{source_path}")
    summary = override.get("summary") or summarize(original)
    if len(summary) < 20 or summary.endswith(":"):
        # An authored override that is too short is a real error; a weak derived
        # summary for an uncurated page falls back to a title-based sentence.
        if override.get("summary"):
            raise RuntimeError(f"{product}:{source_path} needs a meaningful docs_navigation summary")
        summary = fallback_summary(product, source_path)
    return {
        "reader_need": need,
        "topic": override.get("topic") or fallback_topic(source_path),
        "order": override.get("order", 100),
        "summary": summary,
        "related_sourcepaths": override.get("related", []),
    }


def validate_navigation(source_catalog: dict, navigation: dict) -> None:
    for product, config in source_catalog["products"].items():
        product_navigation = navigation.get("products", {}).get(product, {})
        articles = product_navigation.get("articles", {})
        if product_navigation.get("groups") != list(ARTICLE_NEEDS):
            raise RuntimeError(f"{product} docs navigation must list the four reader-need groups in order")
        if product_navigation.get("start") not in articles:
            raise RuntimeError(f"{product} docs navigation start path is not classified")
        selected = {
            path.relative_to(SOURCES / product).as_posix()
            for path in selected_files(SOURCES / product, config)
            if path.suffix.lower() == ".md"
        }
        fallbacks: list[str] = []
        for source_path in selected:
            metadata = articles.get(source_path)
            if metadata is None:
                # Pages without curated metadata are still published; they use
                # derived reader need, topic, ordering, and summary.
                fallbacks.append(source_path)
                continue
            if metadata.get("reader_need") not in (*ARTICLE_NEEDS, *OTHER_NEEDS):
                raise RuntimeError(f"invalid reader_need for {product}:{source_path}")
            if not isinstance(metadata.get("topic"), str) or not metadata["topic"].strip():
                raise RuntimeError(f"{product}:{source_path} is missing its navigation topic")
            if not isinstance(metadata.get("order"), int):
                raise RuntimeError(f"{product}:{source_path} is missing its navigation order")
            for related_path in metadata.get("related", []):
                if related_path not in selected:
                    raise RuntimeError(f"{product}:{source_path} points to an unpublished related source path: {related_path}")
            summary = metadata.get("summary") or summarize((SOURCES / product / source_path).read_text(encoding="utf-8"))
            if len(summary) < 20 or summary.endswith(":"):
                raise RuntimeError(f"{product}:{source_path} needs a meaningful docs_navigation summary")
        if fallbacks:
            print(f"warning: {product} publishes {len(fallbacks)} page(s) using fallback navigation "
                  f"metadata (no docs_navigation.json entry):")
            for source_path in sorted(fallbacks):
                print(f"  - {source_path}")


def write_example_coverage_report(source_catalog: dict, coverage: dict) -> None:
    lines = [
        "# Versioned example coverage",
        "",
        "Generated by `tools/docs.py prepare`. Every tracked YAML file under each selected source snapshot's `examples/` tree is rendered as a version-pinned page with an exact-byte download. Fixture configs remain available in category discovery and are marked as fixtures; integrations are labeled as setup-dependent. The renderer does not claim that configs were executed.",
        "",
        "The inventory includes all cataloged release snapshots and the current development snapshot. YAML under tests, fixtures outside `examples/`, and source/build tooling is outside the user-example path boundary; it is not silently omitted from this catalog because it is not a published example candidate.",
        "All candidate YAML files in these snapshots are under `examples/configs/`; the report has one row for each source path, with every version where it exists.",
        "",
        "## Snapshot counts",
        "",
        "| Product | Snapshot | Commit | YAML pages | Practical | Integration | Fixtures |",
        "| --- | --- | --- | ---: | ---: | ---: | ---: |",
    ]
    for product, config in source_catalog["products"].items():
        versions = [release["version"] for release in config["releases"]] + ["dev"]
        for version in versions:
            if (product, version) not in coverage:
                continue
            sha, entries = coverage[(product, version)]
            counts = {category: sum(item["category"] == category for item in entries.values())
                      for category in ("practical", "integration", "fixture")}
            lines.append(
                f"| {config['name']} | `{version}` | `{sha}` | {len(entries)} | "
                f"{counts['practical']} | {counts['integration']} | {counts['fixture']} |"
            )

    for product, config in source_catalog["products"].items():
        snapshots = {version: entries for (name, version), (_, entries) in coverage.items() if name == product}
        paths = sorted({path for entries in snapshots.values() for path in entries})
        lines.extend([
            "",
            f"## {config['name']} source paths",
            "",
            "Each row names a generated page. Snapshot names identify the releases and development source where that path exists.",
            "",
            "| Source path | Category | Snapshot coverage |",
            "| --- | --- | --- |",
        ])
        for path in paths:
            present = [version for version in snapshots if path in snapshots[version]]
            selected = next((snapshots[version][path] for version in reversed(present)
                             if version == "dev" or version == config["default"]), snapshots[present[-1]][path])
            category = selected["category"]
            if len({snapshots[version][path]["category"] for version in present}) > 1:
                category += " (classification follows each snapshot's metadata)"
            lines.append(f"| `{path}` | {category} | {', '.join(f'`{version}`' for version in present)} |")
    COVERAGE_REPORT.write_text("\n".join(lines) + "\n", encoding="utf-8")


def check_example_catalog_adapter() -> None:
    global DOCS_OUT
    sample_path = "examples/configs/traffic-management/basic-reverse-proxy.yaml"
    root_config_path = "examples/configs/a2a-agent-card-routing.yaml"
    tls_path = "examples/configs/protocols/tls-termination.yaml"
    raw_config = b"listener:\r\n  address: 127.0.0.1:8080\r\n"
    details = example_metadata("praxis", sample_path, raw_config, {})
    assert details["category"] == "practical" and details["featured"]
    grid_context = ExampleContext("grid", "v0.2.1", "v0.2.1", "0123456789abcdef0123456789abcdef01234567",
                                  {"name": "Praxis Grid"}, SOURCES / "grid", {}, set(),
                                  Path("/tmp"), False, "", "")
    _, grid_summary, _, _ = example_page_description(
        grid_context, "examples/helm/site/values.yaml", b"value: true\n", None,
    )
    assert "helm/site/values.yaml" in grid_summary
    assert example_source_mapping({sample_path: raw_config}, set())["examples/configs"] == "examples/configs/_index.md"
    fixture = example_metadata("ai", "examples/configs/openai/responses/agentic-loop-fixture.yaml", b"fixture: true\n", {})
    assert fixture["category"] == "fixture"
    assert example_resources(b"overlay_file: overlay.json\n", "examples/configs/route.yaml",
                             {"examples/configs/overlay.json"}) == {"examples/configs/overlay.json"}
    assert example_resources(b"cert_path: ./localhost+1.pem\n", "examples/configs/protocols/tls.yaml",
                             {"examples/configs/protocols/localhost+1.pem"}) == {
                                 "examples/configs/protocols/localhost+1.pem",
                             }

    original_docs_out = DOCS_OUT
    try:
        with tempfile.TemporaryDirectory() as directory:
            tmp = Path(directory)
            DOCS_OUT = tmp / "docs"
            config = {
                    "name": "Praxis", "repo": "https://github.com/praxis-proxy/praxis",
                    "issues": "https://github.com/praxis-proxy/praxis/issues/new", "default": "v0.7.2",
                    "releases": [{"version": "v0.7.2", "tag": "v0.7.2"}],
            }
            context = ExampleContext("praxis", "v0.7.2", "v0.7.2", "0123456789abcdef0123456789abcdef01234567",
                                     config, SOURCES / "praxis", {}, {sample_path, root_config_path, tls_path},
                                     tmp / "static", False, "", "")
            write_example_pages(context, {
                sample_path: raw_config,
                root_config_path: b"a2a: true\n",
                tls_path: b"cert_path: ./localhost+1.pem\nkey_path: ./localhost+1-key.pem\n",
            }, set())
            download = tmp / "static/praxis/v0.7.2/_assets" / sample_path
            page = tmp / "docs/praxis/v0.7.2" / example_content_path(sample_path)
            category = tmp / "docs/praxis/v0.7.2/examples/configs/traffic-management/_index.md"
            all_configs = tmp / "docs/praxis/v0.7.2/examples/configs/_index.md"
            tls_page = tmp / "docs/praxis/v0.7.2" / example_content_path(tls_path)
            page_text = page.read_text(encoding="utf-8")
            assert download.read_bytes() == raw_config
            assert 'example_featured = true' in page_text and 'example_search = [' in page_text
            assert 'aliases = ["/praxis/latest/examples/configs/traffic-management/basic-reverse-proxy.yaml/"]' in page_text
            assert "{{< docs-version >}}" in page_text
            assert "basic-reverse-proxy" in category.read_text(encoding="utf-8")
            assert "A2A Agent Card Routing" in all_configs.read_text(encoding="utf-8")
            tls_text = tls_page.read_text(encoding="utf-8")
            assert "does not include them" in tls_text and "Companion resources" not in tls_text
    finally:
        DOCS_OUT = original_docs_out
    check_curated_example_paths()


def check_adapter() -> None:
    rewrite_context = {
        "product": "praxis", "version": "dev", "config": {"repo": "https://github.com/example/docs"},
        "repo": ROOT, "sha": "0" * 40, "source_path": "docs/guide.md", "selected": {},
        "assets": ROOT / ".cache" / "check-adapter", "working": True, "known_paths": set(),
    }
    transformed = adapt_page_markdown("# Proxy setup\n\nBuild the proxy.\n", "Proxy setup")
    assert transformed.startswith('<a id="proxy-setup"></a>\n\nBuild the proxy.')
    generated = adapt_page_markdown("<!-- Generated. -->\n\n# `access_log`\n\nLogs requests.\n", "access_log")
    assert generated.startswith('<!-- Generated. -->\n\n<a id="access_log"></a>')
    badge = adapt_page_markdown(
        "![Build status](https://example.test/status.svg)\n\n# First route\n\nRun it.\n",
        "First route", **rewrite_context,
    )
    assert badge.startswith('![Build status](https://example.test/status.svg)\n\n<a id="first-route"></a>')
    comment_and_badge = adapt_page_markdown(
        '<!-- generated -->\n\n![Build status](https://example.test/status.svg)\n\n# Upgrade {#v2-to-v4}\n\nSteps.\n',
        "Upgrade", **rewrite_context,
    )
    assert comment_and_badge.endswith('<a id="v2-to-v4"></a>\n\nSteps.\n')
    assert rewrite_cross_product(
        "https://github.com/praxis-proxy/policy/blob/main/docs/content/apl/pdp.md#structured-request-input"
    ) == "/policy/dev/apl/pdp/#structured-request-input"
    uncataloged_release_link = (
        "https://github.com/praxis-proxy/policy/blob/v0.4.1/docs/content/apl/pdp.md#migrating-args-policies"
    )
    assert rewrite_cross_product(uncataloged_release_link) == uncataloged_release_link
    grid_routing = adapt_page_markdown(
        "# Routing guide\n\n# First section\n\n~~~yaml\n# config\n~~~\n\n# Second section\n",
        "Routing guide", product="grid", source_path="docs/routing.md",
    )
    assert grid_routing == (
        '<a id="routing-guide"></a>\n\n## First section\n\n~~~yaml\n# config\n~~~\n\n## Second section\n'
    )
    grid_nested = adapt_page_markdown(
        "# Routing guide\n\n# First section\n\n## Nested detail\n\n### Deeper\n\n###### Deepest\n",
        "Routing guide", product="grid", source_path="docs/routing.md",
    )
    assert grid_nested == (
        '<a id="routing-guide"></a>\n\n## First section\n\n### Nested detail\n\n#### Deeper\n\n###### Deepest\n'
    )
    other_routing = adapt_page_markdown(
        "# Routing guide\n\n# First section\n", "Routing guide", product="ai", source_path="docs/routing.md",
    )
    assert other_routing.endswith("\n\n# First section\n")
    assert remove_duplicate_initial_h1("# A page\n\nBody", "Different title") == "# A page\n\nBody"
    assert remove_duplicate_initial_h1("# Page {#stable-link}\n\nBody", "Page").startswith('<a id="stable-link"></a>')

    sha = "0123456789abcdef0123456789abcdef01234567"
    source_context = {
        "product": "praxis", "version": "v0.7.2",
        "config": {"repo": "https://github.com/praxis-proxy/praxis"},
        "repo": ROOT, "sha": sha, "source_path": "docs/operating/configuration.md",
        "selected": {"docs/operating/configuration.md": "operating/configuration.md"},
        "assets": ROOT / ".cache" / "check-adapter", "working": False,
        "known_paths": {"examples/configs/operations/hot-reload.yaml", "examples/configs/item.yaml"},
    }
    example_context = {
        **source_context,
        "selected": {
            **source_context["selected"],
            "examples/configs/operations/hot-reload.yaml": "examples/configs/operations/hot-reload.yaml.md",
            "examples/configs": "examples/configs/_index.md",
        },
    }
    reference = rewrite_markdown(
        "See [hot reload][sample].\n\n[sample]: ../../examples/configs/operations/hot-reload.yaml \"Example\"\n",
        **example_context,
    )
    assert "[sample]: /praxis/v0.7.2/examples/configs/operations/hot-reload.yaml/ \"Example\"" in reference
    directory = rewrite_markdown("[examples](../../examples/configs/)\n", **example_context)
    assert "](/praxis/v0.7.2/examples/configs/)" in directory
    html_example = rewrite_markdown('<a href="../../examples/configs/operations/hot-reload.yaml">config</a>\n', **example_context)
    assert 'href="/praxis/v0.7.2/examples/configs/operations/hot-reload.yaml/"' in html_example
    assert example_content_path("examples/configs/item.yaml") == "examples/configs/item.yaml.md"
    assert example_content_path("examples/configs/item.json") == "examples/configs/item.json.md"
    assert example_content_path("examples/configs/item.yaml") != example_content_path("examples/configs/item.json")
    raw_example = rewrite_markdown(
        f"[raw](https://github.com/praxis-proxy/praxis/blob/{sha}/examples/configs/operations/hot-reload.yaml)\n",
        **example_context,
    )
    assert f"https://github.com/praxis-proxy/praxis/blob/{sha}/examples/configs/operations/hot-reload.yaml" in raw_example
    missing_source = rewrite_markdown("[missing](../../docs/not-selected.md#part)\n", **source_context)
    assert f"https://github.com/praxis-proxy/praxis/blob/{sha}/docs/not-selected.md#part" in missing_source

    discovered = set(markdown_links(
        '[inline](sample.yaml) and [reference][sample].\n[sample]: reference.yaml\n'
        '<a href="html.yaml">example</a> ` [code](inline.yaml) `\n'
        '<!-- [comment](comment.yaml) -->\n```markdown\n[fence](fence.yaml)\n```\n'
    ))
    assert discovered == {"sample.yaml", "reference.yaml", "html.yaml"}

    policy_context = {
        **source_context, "product": "policy", "version": "v0.4.0",
        "config": {"repo": "https://github.com/praxis-proxy/policy"},
        "source_path": "docs/content/apl/attributes.md",
        "selected": {"docs/content/extensions.md": "extensions.md"},
    }
    multiline = rewrite_markdown(
        "See [Extensions &\nCapability-Gating](../extensions.md#capabilities).\n",
        **policy_context,
    )
    assert "](/policy/v0.4.0/extensions/#capabilities)" in multiline
    html_link = rewrite_markdown('<a href="../extensions.md#capabilities">read</a>\n', **policy_context)
    assert 'href="/policy/v0.4.0/extensions/#capabilities"' in html_link
    escaped_html = '&lt;a href="../extensions.md#capabilities"&gt;read&lt;/a&gt;\n'
    assert rewrite_markdown(escaped_html, **policy_context) == escaped_html
    html_comment = '<!-- <a href="../extensions.md#capabilities">comment</a> -->\n'
    assert rewrite_markdown(html_comment, **policy_context) == html_comment
    literal_paths = "`[example](../../examples/configs/item.yaml)` and \\[escaped](../../examples/configs/item.yaml).\n"
    assert rewrite_markdown(literal_paths, **source_context) == literal_paths
    fenced_paths = "```markdown\n[example](../../examples/configs/item.yaml)\n```\n"
    assert rewrite_markdown(fenced_paths, **source_context) == fenced_paths

    assert summarize("# Title\n\nA useful summary with `code` and [a link](https://example.test).\n") == "A useful summary with code and a link."
    assert slugify_heading("Dependency Policy & Review") == "dependency-policy--review"
    check_example_catalog_adapter()


def prepare(mode: str) -> None:
    source_catalog = catalog()
    navigation = json.loads(NAVIGATION.read_text(encoding="utf-8"))
    if mode == "build":
        check_catalog_objects(fetch=False)
    validate_navigation(source_catalog, navigation)
    for path in (DOCS_OUT, DATA_OUT, STATIC_OUT, CACHE / "source"):
        shutil.rmtree(path, ignore_errors=True)
        path.mkdir(parents=True)

    products_out: dict = {}
    source_map: list[dict] = []
    example_coverage: dict[tuple[str, str], tuple[str, dict[str, dict]]] = {}
    for product, config in source_catalog["products"].items():
        config = {**config, "repo": repository_url(product)}
        config["issues"] = config["repo"] + "/issues/new"
        repo = SOURCES / product
        expected = pointer(product)
        source_commit, source_status, branch = source_state(product)
        if mode == "build":
            if source_commit != expected:
                raise RuntimeError(f"{product} checkout is {source_commit}, but website records {expected}; review and update the submodule pointer")
            if source_status:
                raise RuntimeError(f"{product} source checkout is dirty:\n{source_status}\nCommit or discard source changes before make build; use make serve to preview edits.")

        versions = []
        releases = config["releases"]
        default_release = config["default"]
        for release in releases:
            version = release["version"]
            sha = release["sha"]
            extracted = CACHE / "source" / product / version
            shutil.rmtree(extracted, ignore_errors=True)
            archived_source(repo, sha, config, extracted)
            selected_source = selected_files(extracted, config)
            mapping: dict[str, str] = {}
            for source_file in selected_source:
                source_rel = source_file.relative_to(extracted).as_posix()
                if source_file.suffix.lower() != ".md":
                    continue
                content_root = PurePosixPath(config["content_root"])
                relative = PurePosixPath(source_rel).relative_to(content_root)
                if source_rel in config.get("indexes", []):
                    output_path = (relative.parent / "_index.md").as_posix()
                else:
                    output_path = relative.as_posix()
                mapping[source_rel] = output_path
            known_paths = repo_paths(repo, sha, working=False)
            examples, example_dirs, example_descriptions = linked_examples(
                selected_source, extracted, repo=repo, sha=sha, working=False, known_paths=known_paths,
            )
            examples.update(tracked_example_configs(repo, sha, working=False))
            mapping.update(example_source_mapping(examples, example_dirs))
            context = ExampleContext(product, version, release["label"], sha, config, repo,
                                     example_descriptions, known_paths, STATIC_OUT, False, "", "")
            copy_extra_assets(context)
            example_coverage[(product, version)] = (
                sha, {path: example_metadata(product, path, body, example_descriptions)
                      for path, body in examples.items()
                      if path.startswith("examples/configs/") and PurePosixPath(path).suffix.lower() in {".yaml", ".yml"}},
            )
            for source_file in selected_source:
                source_rel = source_file.relative_to(extracted).as_posix()
                if source_file.suffix.lower() != ".md":
                    continue
                output_path = mapping[source_rel]
                destination = DOCS_OUT / product / version / output_path
                destination.parent.mkdir(parents=True, exist_ok=True)
                original = source_file.read_text(encoding="utf-8")
                page_body = adapt_page_markdown(
                    original, product=product, version=version, config=config, repo=repo, sha=sha,
                    title=title_for(source_file, original), source_path=source_rel, selected=mapping,
                    assets=STATIC_OUT, working=False, known_paths=known_paths,
                )
                aliases = []
                if version == default_release:
                    aliases.append(site_url(product, "latest", output_path))
                source_mount = re.escape(f".cache/docs/{product}/{version}/")
                path_base = (
                    {"from": "^" + source_mount + re.escape(output_path) + "$", "to": source_rel}
                    if source_rel in config.get("indexes", []) else
                    {"from": "^" + source_mount, "to": config["content_root"] + "/"}
                )
                content_metadata = page_metadata(product, source_rel, original, navigation)
                metadata = {
                    "title": title_for(source_file, original), "product": product, "version": version,
                    "version_label": release["label"], "source_commit": sha,
                    "source_repo": config["repo"], "source_path": source_rel,
                    "issue_url": config["issues"], "version_archive": version != default_release,
                    "github_repo": config["repo"], "github_branch": sha,
                    "github_project_repo": config["repo"],
                    "github_subdir": "",
                    "path_base_for_github_subdir": path_base,
                    "description": content_metadata["summary"],
                    **content_metadata,
                    "aliases": aliases,
                    "cascade": {
                        "product": product, "version": version, "version_label": release["label"],
                        "source_commit": sha, "version_archive": version != default_release,
                    },
                }
                shortcode = "{{< docs-version >}}\n\n{{< docs-mobile-toc >}}\n\n"
                destination.write_text(
                    frontmatter(metadata) + shortcode + page_body
                    + "\n\n{{< docs-source-links >}}\n\n{{< docs-related >}}\n",
                    encoding="utf-8",
                )
                entry = {"product": product, "version": version, "source_path": source_rel,
                         "content_path": output_path, "source_commit": sha, "url": site_url(product, version, output_path)}
                source_map.append(entry)
            source_map.extend(write_example_pages(context, examples, example_dirs))
            versions.append({"slug": version, "label": release["label"], "tag": release["tag"],
                             "sha": sha, "default": release["default"]})

        working = mode == "serve"
        development = config.get("development")
        archive_dev = (not working) and bool(development and development.get("sha"))
        version = "dev"
        if archive_dev:
            # Build the development channel from the tracked upstream ref so it
            # follows unreleased docs independently of the release pointer.
            dev_sha = development["sha"]
            dev_source = CACHE / "source" / product / "dev"
            shutil.rmtree(dev_source, ignore_errors=True)
            archived_source(repo, dev_sha, config, dev_source)
            dev_working = False
            dev_status = ""
            edit_branch = development["ref"]
        else:
            dev_sha = source_commit if working or not source_status else expected
            dev_source = repo
            dev_working = True
            dev_status = source_status
            edit_branch = branch
            if not edit_branch:
                result = subprocess.run(["git", "-C", str(repo), "symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD"],
                                        text=True, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
                edit_branch = result.stdout.strip().removeprefix("origin/") if result.returncode == 0 else ""
        dev_label = f"Development ({dev_sha[:12]})"
        source_files = selected_files(dev_source, config)
        known_paths = repo_paths(repo, dev_sha, working=dev_working)
        mapping = {}
        for source_file in source_files:
            source_rel = source_file.relative_to(dev_source).as_posix()
            if source_file.suffix.lower() != ".md":
                continue
            relative = PurePosixPath(source_rel).relative_to(PurePosixPath(config["content_root"]))
            mapping[source_rel] = (relative.parent / "_index.md").as_posix() if source_rel in config.get("indexes", []) else relative.as_posix()
        examples, example_dirs, example_descriptions = linked_examples(
            source_files, dev_source, repo=repo, sha=dev_sha, working=dev_working, known_paths=known_paths,
        )
        examples.update(tracked_example_configs(repo, dev_sha, working=dev_working))
        mapping.update(example_source_mapping(examples, example_dirs))
        context = ExampleContext(product, "dev", dev_label, dev_sha, config, repo,
                                 example_descriptions, known_paths, STATIC_OUT, dev_working, dev_status, edit_branch)
        copy_extra_assets(context)
        example_coverage[(product, "dev")] = (
            dev_sha, {path: example_metadata(product, path, body, example_descriptions)
                      for path, body in examples.items()
                      if path.startswith("examples/configs/") and PurePosixPath(path).suffix.lower() in {".yaml", ".yml"}},
        )
        for source_file in source_files:
            source_rel = source_file.relative_to(dev_source).as_posix()
            if source_file.suffix.lower() != ".md":
                continue
            output_path = mapping[source_rel]
            destination = DOCS_OUT / product / version / output_path
            destination.parent.mkdir(parents=True, exist_ok=True)
            original = source_file.read_text(encoding="utf-8")
            page_body = adapt_page_markdown(
                original, product=product, version=version, config=config, repo=repo, sha=dev_sha,
                title=title_for(source_file, original), source_path=source_rel, selected=mapping,
                assets=STATIC_OUT, working=dev_working, known_paths=known_paths,
            )
            edit_url = f"{config['repo']}/edit/{edit_branch}/{source_rel}" if edit_branch else None
            source_mount = re.escape(f".cache/docs/{product}/dev/")
            path_base = (
                {"from": "^" + source_mount + re.escape(output_path) + "$", "to": source_rel}
                if source_rel in config.get("indexes", []) else
                {"from": "^" + source_mount, "to": config["content_root"] + "/"}
            )
            content_metadata = page_metadata(product, source_rel, original, navigation)
            metadata = {
                "title": title_for(source_file, original), "product": product, "version": version,
                "version_label": dev_label, "source_commit": dev_sha, "source_repo": config["repo"],
                "source_path": source_rel, "issue_url": config["issues"], "version_archive": False,
                "github_repo": config["repo"], "github_branch": dev_sha,
                "github_project_repo": config["repo"],
                "github_subdir": "",
                "path_base_for_github_subdir": path_base,
                "description": content_metadata["summary"],
                **content_metadata,
                "preview_dirty": bool(dev_status), "edit_url": edit_url,
                "cascade": {
                    "product": product, "version": version, "version_label": dev_label,
                    "source_commit": dev_sha, "version_archive": False,
                    "preview_dirty": bool(dev_status),
                },
            }
            shortcode = "{{< docs-version >}}\n\n{{< docs-mobile-toc >}}\n\n"
            destination.write_text(
                frontmatter(metadata) + shortcode + page_body
                + "\n\n{{< docs-source-links >}}\n\n{{< docs-related >}}\n",
                encoding="utf-8",
            )
            source_map.append({"product": product, "version": version, "source_path": source_rel,
                               "content_path": output_path, "source_commit": dev_sha,
                               "url": site_url(product, version, output_path), "dirty": bool(dev_status)})
        source_map.extend(write_example_pages(context, examples, example_dirs))
        versions.append({"slug": "dev", "label": dev_label, "sha": dev_sha, "default": False})
        products_out[product] = {**config, "versions": versions}
        print(f"{product}: dev {dev_sha[:12]}" + (" (dirty preview)" if dev_status else "")
              + (" (tracking {})".format(edit_branch) if archive_dev else ""))

    (DATA_OUT / "docs_build_versions.json").write_text(
        json.dumps({"products": products_out}, indent=2) + "\n", encoding="utf-8"
    )
    (DATA_OUT / "docs_sources.json").write_text(json.dumps(source_map, indent=2) + "\n", encoding="utf-8")
    write_example_coverage_report(source_catalog, example_coverage)


def update_docs(product: str, ref: str) -> None:
    products = catalog()["products"]
    if product not in products:
        raise RuntimeError(f"unknown product {product!r}; choose one of: {', '.join(products)}")
    if not GIT_REF.fullmatch(ref) and not GIT_SHA.fullmatch(ref):
        raise RuntimeError("REF must be a Git branch, tag, or full commit SHA")
    if ".." in ref or "//" in ref or "@{" in ref or ref.endswith(("/", ".", ".lock")):
        raise RuntimeError("REF is not a valid Git branch, tag, or full commit SHA")
    repo = SOURCES / product
    if git(repo, "status", "--porcelain=v1", "--untracked-files=all"):
        raise RuntimeError(f"{product} source checkout is dirty; preserve or commit the changes before updating")
    run(["git", "-C", str(repo), "fetch", "origin", ref])
    commit = git(repo, "rev-parse", "FETCH_HEAD^{commit}")
    run(["git", "-C", str(repo), "checkout", "--detach", commit])
    print(f"Checked out {product} at {commit}. Review the website pointer; it was not staged or committed.")


def add_docs_version(product: str, ref: str) -> None:
    data = catalog()
    products = data["products"]
    if product not in products:
        raise RuntimeError(f"unknown product {product!r}; choose one of: {', '.join(products)}")
    if not RELEASE_TAG.fullmatch(ref):
        raise RuntimeError("REF must be a full release tag such as v1.2.3")
    config = products[product]
    if any(release["version"] == ref or release["tag"] == ref for release in config["releases"]):
        raise RuntimeError(f"{product} already has a catalog entry for {ref}")
    repo = SOURCES / product
    run(["git", "-C", str(repo), "fetch", "--no-tags", "--depth=1", "origin", f"refs/tags/{ref}:refs/tags/{ref}"])
    sha = git(repo, "rev-parse", f"{ref}^{{commit}}")
    for required in config["required"]:
        result = subprocess.run(["git", "-C", str(repo), "cat-file", "-e", f"{sha}:{required}"])
        if result.returncode:
            raise RuntimeError(f"{product} {ref} is missing required docs path {required}")
    config["releases"].append({"version": ref, "label": ref, "tag": ref, "sha": sha, "default": False})
    config["releases"].sort(key=lambda entry: tuple(int(n) for n in re.findall(r"\d+", entry["version"])), reverse=True)
    CATALOG.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    catalog.cache_clear()
    print(f"Added {product} {ref} at {sha}; review data/docs_versions.json and promote its default explicitly if desired.")


def update_dev_versions() -> None:
    data = catalog()
    products = data["products"]
    changed: list[str] = []
    for product, config in products.items():
        development = config.get("development")
        if not development or not development.get("ref"):
            continue
        ref = development["ref"]
        url = repository_url(product)
        output = run(["git", "ls-remote", url, f"refs/heads/{ref}"], capture=True)
        sha = output.split()[0] if output else ""
        if not GIT_SHA.fullmatch(sha):
            raise RuntimeError(f"could not resolve {product} development ref {ref!r} at {url}")
        if development.get("sha") != sha:
            changed.append(f"{product}: development {ref} -> {sha}")
            development["sha"] = sha
    CATALOG.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    catalog.cache_clear()
    if changed:
        print("Updated development pointers:\n" + "\n".join(changed))
    else:
        print("Development pointers already match the tracked refs.")


def main() -> None:
    parser = argparse.ArgumentParser()
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("init")
    commands.add_parser("check-adapter")
    commands.add_parser("check-release-versions")
    commands.add_parser("update-doc-versions")
    commands.add_parser("update-dev-versions")
    prepare_parser = commands.add_parser("prepare")
    prepare_parser.add_argument("--mode", choices=("build", "serve"), required=True)
    for name in ("update-docs", "add-docs-version"):
        command = commands.add_parser(name)
        command.add_argument("--product", required=True)
        command.add_argument("--ref", required=True)
    args = parser.parse_args()
    try:
        if args.command == "init":
            init()
        elif args.command == "check-adapter":
            check_adapter()
            print("Documentation adapter checks passed.")
        elif args.command == "check-release-versions":
            check_release_versions()
        elif args.command == "update-doc-versions":
            update_doc_versions()
        elif args.command == "update-dev-versions":
            update_dev_versions()
        elif args.command == "prepare":
            prepare(args.mode)
        elif args.command == "update-docs":
            update_docs(args.product, args.ref)
        elif args.command == "add-docs-version":
            add_docs_version(args.product, args.ref)
    except (OSError, RuntimeError, subprocess.CalledProcessError) as error:
        parser.exit(1, f"docs: {error}\n")


if __name__ == "__main__":
    main()
