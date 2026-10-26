# Website contributor guide

Use this guide for changes under `website/`. `README.md` is the source of truth
for setup and command details; this file records durable content, UI, and
ownership decisions.

## Scope and ownership

- Keep changes within the requested scope and preserve unrelated working-tree
  changes. Do not delete files or commit, push, or deploy unless requested.
- `sources/{praxis,ai,policy,grid}` are read-only documentation inputs. Their
  repositories own product facts, prose, examples, and generated references.
  Make source corrections in the owning repository and update its website
  pointer only when that upstream change is ready.
- `.cache/`, `public/`, and Hugo resource output are generated. Change their
  tracked inputs, not generated files; do not change source revisions to work
  around a website presentation issue.
- Prefer Hugo, Docsy, existing helpers, and browser-native controls before
  adding a dependency. Add custom code or a dependency only for a concrete
  reader need that the existing stack cannot meet.

## Site and content model

- Hugo renders authored `content/`, `data/`, local `layouts/`, `assets/`, and
  `static/` with prepared source material. Docsy is the base theme. Main local
  entry points are `tools/docs.py`, `layouts/`, `layouts/shortcodes/`,
  `assets/scss/_styles_project.scss`, and
  `assets/scss/_variables_project.scss`. Read the [Docsy look and feel
  guidance](https://www.docsy.dev/docs/content/lookandfeel/) before changing
  theme presentation.
- `data/docs_versions.json` independently selects each project's releases
  and default. Every Markdown file under a project's `content_root` is
  published automatically; list a path (or a `dir/**` subtree) in that
  project's `exclude` array to keep it off the site. New upstream pages need
  no catalog edit. `required` paths must stay publishable (not excluded).
  `make check-doc-versions` compares defaults with the latest
  published stable releases; `make update-doc-versions` validates required
  docs, adds missing snapshots, promotes those defaults, and moves the source
  submodule pointers. Review its catalog and pointer changes before committing.
  Matching version numbers do not establish cross-project compatibility.
  Each project's optional `development` entry (`{ ref, sha }`) feeds the
  unreleased "Development" (`dev`) channel, which is built from that SHA
  independently of the release pointer; `make update-dev-versions` refreshes
  those SHAs from the tracked upstream ref. `make serve` still previews the
  live submodule working tree for `dev`. Keep the dev channel clearly labelled
  as unreleased and excluded from search/indexing.
- `data/docs_navigation.json` maps source pages to Diátaxis reader needs,
  topics, order, summaries, and related links. Update metadata when an
  imported page's site grouping or label changes; do not duplicate that logic
  in templates. Metadata is optional: a published page without an entry falls
  back to a derived reader need, topic, order, and summary, and `prepare`
  prints a warning listing those pages so they can be curated. Use the
  [Diátaxis framework](https://diataxis.fr/) to classify a page by its
  reader's need, not its filename.
- `data/example_metadata.json` holds curated task names, summaries,
  prerequisites, outcomes, and featured examples. Keep it aligned with the
  original source path and actual example behavior. Derive lists from source
  data and metadata; do not hardcode example totals.
- `docs/original-route-mapping.json` is required build input for historical
  redirects. Keep it tracked and preserve established paths and useful
  fragments when reorganizing content. The adjacent Markdown explanation is
  also a tracked maintainer reference.

## Content and product accuracy

- Order visitor journeys around the task: first proxy and installation, then
  configuration and operation, then explanation/reference, with Rust
  extension and contribution work as a distinct developer path. Keep operator
  tasks easy to discover. Use “Projects” in visitor-facing labels and prose;
  internal metadata may retain `product` identifiers.
- Describe Praxis as a configurable HTTP reverse proxy and TCP forwarder with
  an extensible Rust framework. Check the selected release before making
  claims about protocols, including HTTP/TCP boundaries, HTTP CONNECT, and
  HTTP/3. Attribute the OpenAI-compatible gateway and AI-specific capabilities
  to Praxis AI; explain Policy as a separate project and integration.
- Separate default behavior, runtime configuration, compile-time build
  features, optional integrations, planned work, and unsupported behavior.
  Describe TLS, CORS, limits, security controls, and unsafe-code policy at the
  scope the selected source supports. Do not imply the independently selected
  project releases form a tested compatibility set.
- Treat an example's source presence or byte-identical download as evidence of
  provenance, not execution. Label practical configurations, setup-dependent
  integrations, and fixtures accurately. State required services, backends,
  certificates, environment variables, credentials, and build features; use
  placeholders and never publish real secrets. Explain private-endpoint
  protections and any local-only opt-in where they affect the procedure.
- Keep instructions runnable: identify prerequisites, complete configuration,
  validation/start commands, the expected result, and cleanup when relevant.
  Verify behavior against the selected binary/image when making a runtime
  claim; distinguish that result from syntax checks or source review.
- Preserve release context in links and page controls. Identify default,
  archived, and development content accurately. Resolve each `latest` alias
  from that project's catalog default, and recheck it after promotion. Keep
  source commits, downloads, and contribution actions aligned with the page.

## Hugo links and templates

- Use `docs-link` for imported pages; it resolves `source_path` against the
  product's catalog default and fails the build when the target is missing.
  Use `docs-asset` for imported assets; it defaults to that release and accepts
  an explicit catalog version. Preserve source attribution and exact imported
  download bytes.
- Use Hugo `relURL`/`relref` for authored links. Check routes and assets with
  a non-root `HUGO_BASEURL` as well as the local root path. Keep canonical,
  archive, development, and fallback behavior explicit when changing version
  switching; explain when a requested page falls back to a version overview.
- Follow current template APIs: use `hugo.Data` for shared data and `site.Pages`
  for site pages. Avoid deprecated `.Site.AllPages`; verify Hugo APIs against
  the configured environment before introducing an unused method.
- Prefer existing shortcodes and partials for version controls, source actions,
  figures, and links. They carry the site's URL, version, and accessibility
  behavior. View-source links identify the exact snapshot commit; edit links
  target a configured maintained branch and original path. Release tags are
  not edit targets; retain issue and contribution guidance for archives.

## Navigation and interface

- Keep examples in their project/version/category hierarchy, with a path back
  to the catalog and to relevant documentation. Render page-specific sidebar
  selection in that page's context; do not share-cache active state across
  pages or versions. `aria-current="page"` belongs only on the exact current
  link; use `aria-current="location"` only for broad section context.
- Keep search scoped by project and version. Default results use each project's
  default docs; archived and development material requires an explicit scope.
  Preserve accessible loading, empty, error, and retry states.
- Preserve the light/dark themes, responsive layouts, Docsy navigation,
  mobile topbar, visible keyboard focus, and selected page/category in the
  sidebar. Use project SCSS tokens and self-hosted IBM Plex Sans/Mono, retaining
  font licenses and `font-display: swap`. Customize via supported Hugo/Docsy
  hooks; do not edit cached theme code.
- Use semantic HTML and native controls. Check keyboard operation, heading and
  landmark structure, target purpose, normal-text contrast (4.5:1), and
  reflow at 320 CSS pixels against the WCAG 2.2 AA target. Respect reduced-motion
  preferences. Automated scans supplement visual and keyboard review.
- Keep titles clear of the fixed topbar and anchor targets. Keep code, tables,
  and figures readable on narrow screens; do not rely on color, hover, or
  motion alone to convey meaning.

## Diagrams and walkthroughs

- Prefer a small static diagram only when it clarifies a concrete task or
  concept. Provide useful alternative text, a caption that states the point,
  and source/release/license attribution for reused artwork. Keep source assets
  byte-for-byte intact.
- Check label fit, box padding, arrow endpoints and direction, theme contrast,
  and page containment on desktop and mobile in both themes. Large diagrams
  should remain keyboard-scrollable and have a text equivalent.
- Do not restore broad Visual guides promotion. Keep their established routes
  and original diagrams available for existing links; link directly to the
  authoritative versioned explanation when that serves the reader better.
- Reuse the existing native SVG/JavaScript walkthrough when interaction adds
  value. It loads on demand; its complete ordered explanation must remain
  available without JavaScript. FlowStory was researched but not adopted. A
  new runtime dependency needs a clear advantage over existing native code,
  source/license review, and an accessible static alternative. Keep custom
  interaction JavaScript within the existing 20 KB gzip budget.

## Build and completion

- Follow `README.md` for Docker and Make commands. `make serve` and production
  build/check prepare into the shared `.cache/`; stop the preview before a
  production build/check, and restart it afterward. Never hand-edit prepared
  files. `make clean` removes generated output; preserve it if it contains
  state needed for the task.
- Choose checks by change. Use `make check` for adapter, presentation, and
  internal-link contracts as appropriate. For example-sidebar/navigation
  changes, run `tools/examples-navigation-check.cjs`; use
  `tools/browser-check.cjs` or `tools/next-experience-check.cjs` for real
  viewport/theme/interaction behavior, `tools/check-diagrams.cjs` for diagram
  geometry, and `tools/performance-check.cjs` for performance-sensitive
  changes. Follow README for setup and invocation.
- Treat LCP ≤2.5s and CLS ≤0.1 as local mobile lab regression targets, not
  deployed-site guarantees. Record test conditions when comparing results.
- Before finishing, review the diff for scope, unsupported claims, source
  revision drift, broken links/fragments, current-page state, and generated
  output. Report what was checked, the outcome, and meaningful limits such as
  integrations or platforms not exercised.

## Local skills

Most files under `docs/` are ignored local plans, reviews, research, and
evidence; do not link published content or contributor instructions to them.
The original-route mapping JSON and its Markdown explanation are tracked
exceptions. Keep screenshots and temporary reports in ignored output paths.

These public links are discovery references to upstream instructions, not
installed-version pins. Skills are optional local aids, not site dependencies.
When a skill fits, find it in the available skill catalog, read its local
`SKILL.md` and referenced materials, and review any executable helper before
running it. Record an immutable skill revision in local notes when it materially
informs a review. Keep skill installations and isolated QA tools outside site
dependency manifests.

| Skill used in this website work | Use it for | Public source |
| --- | --- | --- |
| Impeccable | UX critique and code-level UI audit | [Impeccable](https://github.com/pbakaus/impeccable) |
| frontend-design | Visual direction, typography, and composition | [frontend-design](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md) |
| web-design-guidelines | Interface conventions, responsiveness, and accessibility review | [web-design-guidelines](https://github.com/vercel-labs/agent-skills/blob/main/skills/web-design-guidelines/SKILL.md) |
| Playwright | Real-browser journeys, viewport checks, and screenshots | [Playwright](https://github.com/openai/skills/blob/main/skills/.curated/playwright/SKILL.md) |
| Ponytail | Keep code changes minimal and avoid unnecessary dependencies | [Ponytail](https://github.com/DietrichGebert/ponytail/blob/main/skills/ponytail/SKILL.md) |
| Writing for Agents | Create or revise `AGENTS.md` and other agent-facing instructions | [Writing for Agents](https://github.com/mattpocock/skills/blob/main/skills/productivity/writing-for-agents/SKILL.md) |

If the user requests delegated work, keep it within the requested scope, use
at most three GPT-6-luna medium workers, assign non-overlapping files, and have
the root agent review the integrated result.
