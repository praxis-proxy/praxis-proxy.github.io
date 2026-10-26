+++
title = "Praxis Grid"
description = "A Kubernetes control plane for multi-site AI inference routing."
type = "landing"
layout = "list"
product = "grid"
body_class = "product-overview-page"
+++

Praxis Grid (AI Grid Network, AGN) discovers and evaluates inference providers across Kubernetes sites, then publishes routing state for Praxis AI gateways. Gateways handle requests; Grid is a separate control plane.

{{< docs-link product="grid" source="docs/installation/existing-clusters.md" label="Install Grid on existing Kubernetes clusters" >}}

{{< docs-link product="grid" source="docs/architecture/overview.md" label="Read the Grid architecture overview" >}}. {{< docs-link product="grid" source="docs/technical-preview-scope.md" label="Review technical-preview scope and limitations" >}}

Grid v0.2.2 is a technical preview. Grid, Praxis AI, and Praxis releases are selected independently; this documentation does not establish a tested compatibility set. See the [Grid source repository](https://github.com/praxis-proxy/grid) for source and release artifacts. For historical context, the archived website retains the [legacy Getting Started guide](https://github.com/praxis-proxy/praxis-proxy.github.io/blob/43fb08a65bdf4341d78adb829ffcd6cc5e4d8131/docs/grid/getting-started.md), [Overview](https://github.com/praxis-proxy/praxis-proxy.github.io/blob/43fb08a65bdf4341d78adb829ffcd6cc5e4d8131/docs/grid/overview.md), [Concepts](https://github.com/praxis-proxy/praxis-proxy.github.io/blob/43fb08a65bdf4341d78adb829ffcd6cc5e4d8131/docs/grid/concepts.md), and [booklet HTML source](https://github.com/praxis-proxy/praxis-proxy.github.io/blob/43fb08a65bdf4341d78adb829ffcd6cc5e4d813/static/praxis-grid-booklet.html). Use the versioned installation guide above for current setup instructions; the archived pages describe the earlier Grid design.
