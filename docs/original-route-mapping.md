# Original route mapping

The mapping below covers all 40 public HTML URLs in [`original-site-inventory.json`](original-site-inventory.json). Canonical source pages use the selected product release; root aliases should preserve incoming fragments and accept both the crawled path and its slash variant. Paths that already exist on the new site stay in place.

Grid routes now resolve to the pinned v0.2.1 documentation. The blog contains the one retained announcement, so its index and post routes stay in place; archive and tag paths lead back to the blog. The earlier community summary route remains an alias to the post. Current examples and search pages remain at their existing routes.

| Original path | Destination | Treatment |
| --- | --- | --- |
| `/` | `/` | Keep the ecosystem homepage. |
| `/blog` | `/blog/` | Keep the blog index. |
| `/blog/archive` | `/blog/` | Alias to the one-post blog. |
| `/blog/tags` | `/blog/` | Alias to the one-post blog. |
| `/blog/tags/announcement` | `/blog/welcome/` | Alias to the retained announcement. |
| `/blog/welcome` | `/blog/welcome/` | Keep the retained announcement. |
| `/docs/architecture/connection-lifecycle` | `/praxis/v0.7.2/architecture/connection-lifecycle/` (`docs/architecture/connection-lifecycle.md`) | Release-resolved page. |
| `/docs/architecture/crate-layout` | `/praxis/v0.7.2/architecture/crate-layout/` (`docs/architecture/crate-layout.md`) | Release-resolved page. |
| `/docs/architecture/filter-pipeline` | `/praxis/v0.7.2/architecture/pipeline-concepts/` (`docs/architecture/pipeline-concepts.md`) | Release-resolved pipeline explanation; branch-chain reference remains linked. |
| `/docs/architecture/http-correctness` | `/praxis/v0.7.2/architecture/http-correctness/` (`docs/architecture/http-correctness.md`) | Release-resolved page. |
| `/docs/architecture/interactive-diagram` | `/visual-guides/praxis/` | Alias to the current Core guide. |
| `/docs/architecture/overview` | `/praxis/v0.7.2/architecture/overview/` (`docs/architecture/overview.md`) | Release-resolved page. |
| `/docs/architecture/payload-processing` | `/praxis/v0.7.2/architecture/payload-processing/` (`docs/architecture/payload-processing.md`) | Release-resolved page. |
| `/docs/architecture/pingora-integration` | `/praxis/v0.7.2/architecture/connection-lifecycle/` (`docs/architecture/connection-lifecycle.md`) | Closest current runtime-lifecycle explanation; the v0.7.2 overview identifies Pingora ownership. |
| `/docs/architecture/system-design` | `/praxis/v0.7.2/architecture/overview/` (`docs/architecture/overview.md`) | Current overview replaces the old combined design page. |
| `/docs/configuration/overview` | `/praxis/v0.7.2/operating/configuration/` (`docs/operating/configuration.md`) | Release-resolved reference. |
| `/docs/development/benchmarks` | `/praxis/v0.7.2/benchmarks/` (`docs/benchmarks.md`) | Release-resolved methodology; no unmeasured results are added. |
| `/docs/development/contributing` | `/guides/extend/` | Developer setup and contribution entry points. |
| `/docs/development/proposals` | `https://github.com/praxis-proxy/enhancements` | External canonical proposal project. |
| `/docs/development/release` | `/praxis/v0.7.2/release/` (`docs/release.md`) | Release-resolved process. |
| `/docs/development/testing` | `/guides/extend/` (`docs/developing/getting-started.md`) | Developer setup includes test commands; source path is linked there. |
| `/docs/filters/` | `/praxis/v0.7.2/filters/` (`docs/filters/README.md`) | Release-resolved filter index. |
| `/docs/filters/custom-filters` | `/praxis/v0.7.2/filters/http-filter-tutorial/` (`docs/filters/http-filter-tutorial.md`) | Release-resolved Rust tutorial. |
| `/docs/filters/extensions` | `/praxis/v0.7.2/filters/extensions/` (`docs/filters/extensions.md`) | Release-resolved extension guide. |
| `/docs/filters/filter-model` | `/praxis/v0.7.2/filters/#filter-model` (`docs/filters/README.md`) | Release-resolved page and matching heading anchor. |
| `/docs/getting-started/features` | `/praxis/capabilities/` | Website-owned v0.7.2 capability/build/support matrix. |
| `/docs/getting-started/installation` | `/guides/install/` | Website-owned verified installation choices. |
| `/docs/getting-started/introduction` | `/praxis/` | Updated runnable-proxy overview. |
| `/docs/getting-started/quickstart` | `/guides/first-proxy/` | Website-owned end-to-end reverse-proxy tutorial. |
| `/docs/grid/concepts` | `/grid/v0.2.1/architecture/crds/` (`docs/architecture/crds.md`) | Release-pinned CRD reference; links to the updated architecture and routing explanations. |
| `/docs/grid/getting-started` | `/grid/v0.2.1/installation/existing-clusters/` (`docs/installation/existing-clusters.md`) | Release-pinned Kubernetes installation procedure and prerequisites. |
| `/docs/grid/overview` | `/grid/v0.2.1/architecture/overview/` (`docs/architecture/overview.md`) | Release-pinned architecture, discovery, routing, and trust overview. |
| `/docs/protocols/tls` | `/praxis/v0.7.2/operating/tls/` (`docs/operating/tls.md`) | Release-resolved TLS/mTLS guide. |
| `/docs/security/hardening` | `/praxis/v0.7.2/operating/security-hardening/` (`docs/operating/security-hardening.md`) | Release-resolved hardening guide. |
| `/examples/` | `/examples/` | Keep the new versioned example discovery hub. |
| `/praxis-ai-booklet.html` | `/visual-guides/ai/` | Alias to current AI visual guide. |
| `/praxis-core-booklet.html` | `/visual-guides/praxis/` | Alias to current Core visual guide. |
| `/praxis-grid-booklet.html` | `/grid/v0.2.1/architecture/overview/` (`docs/architecture/overview.md`) | Current text overview replaces the booklet route; the original booklet source remains linked from `/grid/`. |
| `/search` | `/search/` | Keep the current local search page. |
| `/architecture/diagram.html` | `/visual-guides/praxis/` | Alias to current Core visual guide. |

## Alias notes

- The inventory stores a mix of slash and non-slash routes. Test both forms at the actual configured base path.
- Redirects from old source pages to versioned docs should preserve fragments. Keep historical heading IDs where a current heading differs; `/docs/filters/filter-model` specifically maps to `#filter-model` on the current filter index.
- If a later catalog update changes the default Praxis tag, review the versioned destinations before regenerating aliases. The current map intentionally uses v0.7.2.
- `docs/original-route-mapping.json` is the machine-readable counterpart for the root alias work.
