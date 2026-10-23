.DEFAULT_GOAL := help
HUGO ?= hugo
HUGO_ARGS = --cacheDir $(CURDIR)/.cache/hugo
HUGO_ENV = PATH=$(CURDIR)/node_modules/.bin:$$PATH
HUGO_DESTINATION ?= public
LINK_BASEURL = $(patsubst %/,%,$(or $(HUGO_BASEURL),https://praxis.fast/))/
LINK_PREFIX = $(shell printf '%s' '$(LINK_BASEURL)' | sed -E 's|^[a-zA-Z][a-zA-Z0-9+.-]*://[^/]*||; s|/+$$||')
CONTAINER_USER = --user $(shell id -u):$(shell id -g)
CONTAINER_MAKE = docker compose run --build --rm $(CONTAINER_USER) website make HUGO_DESTINATION="$(HUGO_DESTINATION)"

.PHONY: help init init-in-container build build-in-container build-host serve serve-in-container check check-in-container check-doc-versions update-doc-versions update-doc-versions-in-container update-dev-versions update-dev-versions-in-container update-docs update-docs-in-container add-docs-version add-docs-version-in-container clean

help:
	@printf '%s\n' \
	  'init               Initialize missing source submodules and site dependencies in Docker' \
	  'build              Prepare every docs snapshot and build the complete site' \
	  'build-host         Same as build-in-container, for Netlify and other non-Docker hosts' \
	  'serve              Preview docs, including local source edits and revision state' \
	  'check              Build and check generated internal links and fragments' \
	  'check-doc-versions Verify catalog defaults match the latest published releases' \
	  'update-doc-versions Refresh defaults and source pointers from latest releases' \
	  'update-dev-versions Refresh the development channel SHAs from tracked upstream refs' \
	  'update-docs PRODUCT=policy REF=<tag-or-commit>' \
	  'add-docs-version PRODUCT=policy REF=<release-tag>' \
	  'clean              Remove generated site output, keeping sources and authored files'

init:
	$(CONTAINER_MAKE) init-in-container

init-in-container:
	python3 tools/docs.py init
	mkdir -p .cache/docs .cache/docs-data .cache/docs-static
	go mod download
	$(HUGO_ENV) $(HUGO) $(HUGO_ARGS) mod npm pack
	@if [ ! -f package-lock.json ]; then npm install; else \
	  manifest_hash="$$(sha256sum package.json packages/hugoautogen/package.json package-lock.json | sha256sum | cut -d' ' -f1)"; \
	  if [ ! -d node_modules/sass-embedded ] || [ "$$manifest_hash" != "$$(cat node_modules/.manifest-hash 2>/dev/null)" ]; then \
	    npm ci && printf '%s\n' "$$manifest_hash" > node_modules/.manifest-hash; \
	  fi; \
	fi
	SASS_BINARY="$$(node -e 'const p=process.platform==="linux"&&!process.report.getReport().header.glibcVersionRuntime?"linux-musl":process.platform; const path=require("path"); const root=path.resolve(path.dirname(require.resolve("sass-embedded")), "../../.."); process.stdout.write(path.join(root, "sass-embedded-"+p+"-"+process.arch, "dart-sass", "sass"))')"; test -x "$$SASS_BINARY"; ln -sf "$$SASS_BINARY" node_modules/.bin/sass

build:
	$(CONTAINER_MAKE) build-in-container

# Host build used by Netlify Deploy Previews. Requires hugo, go, python3, npm, and make
# on PATH. Honor HUGO_BASEURL (Hugo config env) for preview base URLs.
build-host: build-in-container

build-in-container: init-in-container
	python3 tools/docs.py prepare --mode build
	python3 tools/prepare-routes.py
	$(HUGO_ENV) $(HUGO) $(HUGO_ARGS) --environment production --minify --cleanDestinationDir --destination "$(HUGO_DESTINATION)"

serve:
	docker compose run --build --rm --service-ports $(CONTAINER_USER) website make serve-in-container

serve-in-container: init-in-container
	python3 tools/docs.py prepare --mode serve
	python3 tools/prepare-routes.py
	$(HUGO_ENV) $(HUGO) $(HUGO_ARGS) server --destination .cache/serve-public --baseURL http://localhost:1313/ --bind 0.0.0.0 --disableFastRender

check:
	$(CONTAINER_MAKE) check-in-container

# lychee reads rendered links from the built files; verbatim scanning also treats
# URL-looking code examples as links. Rendered HTML href/src attributes are checked.
# The first --remap checks the site's own absolute URLs (canonical,
# feeds, sitemap) against the build instead of skipping them as external; the
# second, for a base URL with a path (LINK_PREFIX, e.g. /docs), maps root-relative
# links such as /docs/page/ to the files directly under the build directory.
check-in-container: build-in-container
	python3 tools/docs.py check-adapter
	python3 tools/check-presentation.py --public "$(HUGO_DESTINATION)"
	lychee --offline --include-fragments=anchor-only --index-files index.html \
		--root-dir "$(abspath $(HUGO_DESTINATION))" \
		--remap "^$(LINK_BASEURL) file://$(abspath $(HUGO_DESTINATION))/" \
		$(if $(LINK_PREFIX),--remap "^file://$(abspath $(HUGO_DESTINATION))$(LINK_PREFIX)/ file://$(abspath $(HUGO_DESTINATION))/") \
		--no-progress --format compact \
		"$(HUGO_DESTINATION)/**/*.html" "$(HUGO_DESTINATION)/**/*.css" "$(HUGO_DESTINATION)/**/*.xml"

check-doc-versions:
	python3 tools/docs.py check-release-versions

update-doc-versions:
	$(CONTAINER_MAKE) update-doc-versions-in-container

update-doc-versions-in-container:
	python3 tools/docs.py update-doc-versions

update-dev-versions:
	$(CONTAINER_MAKE) update-dev-versions-in-container

update-dev-versions-in-container:
	python3 tools/docs.py update-dev-versions

update-docs:
	$(CONTAINER_MAKE) update-docs-in-container PRODUCT="$(PRODUCT)" REF="$(REF)"

update-docs-in-container:
	python3 tools/docs.py update-docs --product "$(PRODUCT)" --ref "$(REF)"

add-docs-version:
	$(CONTAINER_MAKE) add-docs-version-in-container PRODUCT="$(PRODUCT)" REF="$(REF)"

add-docs-version-in-container:
	python3 tools/docs.py add-docs-version --product "$(PRODUCT)" --ref "$(REF)"

clean:
	rm -rf .cache public resources/_gen .hugo_build.lock
