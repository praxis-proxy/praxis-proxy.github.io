# Praxis documentation site
[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Fpraxis-proxy%2Fwebsite.svg?type=shield)](https://app.fossa.com/projects/git%2Bgithub.com%2Fpraxis-proxy%2Fwebsite?ref=badge_shield)


One Hugo site publishes shared ecosystem pages and versioned docs from the Praxis, Praxis AI, Policy, and Grid repositories. Product source repositories remain authoritative; prepared Markdown and assets live only in ignored `.cache/` output.

For documentation and website contributions, read [AGENTS.md](AGENTS.md) for source ownership, editorial and UI conventions, validation, and optional skill guidance.

## Requirements

- Docker Engine with Docker Compose v2
- GNU Make

The container uses the official Hugo Extended 0.167.0 image and supplies the remaining build tools. Dependabot checks Docker, Go modules, npm workspaces, and GitHub Actions weekly. Docsy 0.17.0 and Dart Sass 1.102.0 are pinned by the website manifests, and the container image pins the lychee link checker. Initialization points Hugo's `sass` command at the locked platform executable. The lightweight version freshness check uses host Python 3 and the GitHub API. See the [Docsy setup guide](https://www.docsy.dev/docs/get-started/docsy-as-module/installation-prerequisites/) and [0.17.0 release notes](https://www.docsy.dev/blog/2026/0.17.0/).

## Build and preview

```sh
make help
make init
make serve
make build
make check
```

`make init`, `make serve`, `make build`, `make check`, and the documentation revision commands run in Docker. The checkout is mounted into the container, so `make serve` includes local source edits and prints each source revision and dirty state. `make build` requires each checkout to be clean and at the pointer recorded by this repository. Neither command runs a product build or generator.

Open **http://localhost:1313/** after `make serve` starts. Stop the preview with Ctrl+C.

Preview output lives in `.cache/serve-public`; production builds use `public`. Restart an existing preview after updating the Makefile so it picks up the separate output directory. For an isolated build and link check while previewing, use `make check HUGO_DESTINATION=.cache/review-public`.

The configured base URL defaults to `https://praxis.fast/`. Override Hugo's standard `baseURL` setting without editing links or templates:

```sh
HUGO_BASEURL=https://docs.example.com/ make build
```

## Pull request previews and production

Pull requests build a **Netlify Deploy Preview** through the existing Netlify GitHub integration. The build runs `make build-host` (same prepare and Hugo steps as the Docker build, without Docker) with `HUGO_BASEURL` set to the preview URL. Configuration lives in [`netlify.toml`](netlify.toml).

Production publishing stays on **GitHub Pages** via `make build` and [`.github/workflows/pages.yml`](.github/workflows/pages.yml). Netlify production deploys are skipped so the two hosts do not compete.

In the Netlify site settings, keep **Deploy Previews** enabled for pull requests. The build command runs `git submodule update --init --recursive` so `sources/{praxis,ai,policy,grid}` are present for `tools/docs.py prepare` (those submodule URLs are HTTPS). If a submodule is private, grant the Netlify GitHub App or deploy key access to it. PR validation (`make check`) continues to run in GitHub Actions separately from the preview deploy.

## Source revisions and releases

`sources/{praxis,ai,policy,grid}` are read-only documentation inputs. Git records their working revisions as submodule pointers. Release commits and defaults are in [`data/docs_versions.json`](data/docs_versions.json); each project is versioned independently. CI checks each default against that repository's latest published stable GitHub release. Run the check locally with `make check-doc-versions`; it uses the public GitHub API.

After `make init` has initialized the source submodules, add the latest published stable release for each project, validate its required docs, promote it, and move the matching source pointers together with:

```sh
make update-doc-versions
```

Review the catalog and submodule changes before committing; the source pointer changes remain unstaged. The manual command for adding a selected archived version still leaves it non-default:

```sh
make add-docs-version PRODUCT=policy REF=v0.4.1
```

Review the added SHA and docs, then mark exactly one release as that product's default in the catalog. `make update-docs` moves only the named submodule and leaves the pointer change unstaged for review:

```sh
make update-docs PRODUCT=praxis REF=v0.5.5
git diff --submodule=log -- sources/praxis
```

Submodule checkouts are often detached. For a source documentation contribution, make and publish the edit in the product repository first, then update the website pointer to that commit. Do not edit prepared `.cache/` content; it is regenerated on every preparation.

`make clean` removes generated content, public output, and Hugo resources while retaining submodules and authored website files.

## Website presentation

Hugo and Docsy provide the site foundation. Website-owned templates, SVG identity assets, self-hosted IBM Plex fonts, and SCSS customize the experience. Imported product prose stays in its owning repository.

The website-owned reader paths are `/guides/first-proxy/`, `/guides/install/`, `/guides/operate/`, `/guides/extend/`, `/examples/`, `/visual-guides/`, and `/blog/`. Authored blog posts live under `content/blog/`; the retained welcome announcement is the only current post, and `/community/welcome/` redirects to it. The example adapter inventories every tracked YAML configuration under each selected snapshot's `examples/` tree. Curated starting tasks live in `data/example_metadata.json`; downloads retain source bytes, and setup-dependent integrations and fixtures are labeled separately. Running `make build` or `make serve` generates the coverage report at `docs/example-coverage-report.md`.

`docs/original-route-mapping.json` records the 40 assessed original-site URLs. `tools/prepare-routes.py` resolves their documentation targets against the selected versions and generates redirects during Docker build/serve. Edit that mapping rather than generated redirect pages.

Every Markdown file under a project's `content_root` is published automatically; add a path or `dir/**` subtree to that project's `exclude` array in `data/docs_versions.json` to keep it off the site. Navigation metadata lives in `data/docs_navigation.json`, keyed by product and original source path. It controls reader need, topic, ordering, summary overrides, and related pages across snapshots. Metadata is optional — a page without an entry falls back to a derived reader need, topic, order, and summary, and `prepare` warns which pages use fallbacks so they can be curated. Search indexes are generated by product/version and fetched only when needed; `/search/` accepts `q`, `product`, `version`, and `form` query parameters.

The top-level Projects menu opens each project's selected documentation release. Authored Praxis guides share the documentation sidebar with that release; project sidebars link to their versioned example catalogs. The cross-project `/examples/` directory remains available for discovery.

`make check` includes adapter checks, presentation contracts, and internal links/fragments. Browser QA uses separately pinned tools, with no website npm dependency added:

```sh
npm install --prefix /tmp/praxis-website-qa --no-audit --no-fund playwright@1.58.2 axe-core@4.11.1
python3 tools/qa-server.py --port 18131
# In another terminal, with Google Chrome installed:
NODE_PATH=/tmp/praxis-website-qa/node_modules node tools/browser-check.cjs
NODE_PATH=/tmp/praxis-website-qa/node_modules node tools/next-experience-check.cjs
NODE_PATH=/tmp/praxis-website-qa/node_modules node tools/performance-check.cjs
```

The browser scripts use `/usr/bin/google-chrome` by default. Set `QA_BROWSER_PATH` to another Chromium-based browser executable when needed.

Screenshots and JSON reports go to `/tmp/praxis-redesign-qa`; set `QA_BASE_URL` or `QA_OUTPUT` to change those locations. Browser checks cover the catalog snapshots used in this redesign; update their representative release selections when the catalog changes. The QA server compresses text assets with gzip. The performance check uses three uncached local mobile loads at 390×844, 4× CPU slowdown, 150ms latency, and 1.6 Mbps download throughput. This is a repeatable laboratory profile, not deployed-site field data.

The next-experience script writes to ignored `output/playwright/` by default. It checks new reader paths, both themes at six widths, search failure/recovery, and the lazy AI walkthrough with keyboard, reduced-motion, and JavaScript-disabled alternatives.

The first-proxy tutorial can be checked with an externally built v0.7.2 binary or the published image. Both commands bind local ports 3000 and 8080; the image check uses Linux host networking:

```sh
python3 tools/check-onboarding.py --binary /path/to/praxis
python3 tools/check-onboarding.py --image ghcr.io/praxis-proxy/praxis:0.7.2
```


## License
[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Fpraxis-proxy%2Fwebsite.svg?type=large)](https://app.fossa.com/projects/git%2Bgithub.com%2Fpraxis-proxy%2Fwebsite?ref=badge_large)
