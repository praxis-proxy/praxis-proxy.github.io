+++
title = "Multi-region deployment"
description = "Run gateways in several Kubernetes clusters or regions and let each one route to eligible inference providers across all of them."
type = "guides"
body_class = "guides-page gateway-page"
+++

A single gateway routes to the providers in its own configuration. When inference capacity spans several Kubernetes clusters, often in different regions, the gateway's multi-cluster control plane tells every gateway which providers in which cluster are currently eligible. Each gateway then makes the routing decision locally, on the request path.

This capability is a **technical preview** at {{< product-release product="grid" />}}. Read {{< docs-link product="grid" source="docs/technical-preview-scope.md" label="the preview scope and limits" >}} before you plan a deployment.

## How it fits the gateway

```text
Control plane: cluster resources + local health + signals from peer clusters
  → scored routing candidates
  → versioned routing overlay
Gateway: validates the overlay, then intelligent routing serves requests from it
```

- The control plane decides what is routable. It does not proxy requests, inject provider credentials or terminate data-plane TLS.
- Each gateway keeps its request path local. A request does not call Kubernetes or a peer cluster to choose a provider.
- Gateways read the overlay through {{< docs-link product="ai" source="docs/filters/intelligent_route.md" label="intelligent routing" >}}, the same filter a single-cluster deployment uses.

## What you supply

You provision the clusters, the inference backends and their capacity, the network paths between clusters, the gateways and their credential Secrets, and any global entry point such as DNS-based load balancing. The control plane observes declared providers; it does not create a cluster network or copy Secrets between clusters.

## Set it up

1. {{< docs-link product="grid" source="docs/installation/existing-clusters.md" label="Install the control plane on existing clusters" >}}, or {{< docs-link product="grid" source="docs/installation/aws.md" label="on AWS" >}}.
2. {{< docs-link product="grid" source="docs/installation/enrollment.md" label="Enroll each additional cluster" >}}.
3. {{< docs-link product="grid" source="docs/adding-provider.md" label="Declare the inference providers" >}} in each cluster.
4. {{< docs-link product="grid" source="docs/routing.md" label="Choose a cross-cluster routing behavior" >}}, then {{< docs-link product="grid" source="docs/site-selection.md" label="tune cluster selection" >}}.

To understand the moving parts, start with {{< docs-link product="grid" source="docs/architecture/overview.md" label="the multi-cluster architecture" >}}. For day-to-day work, see {{< docs-link product="grid" source="docs/architecture/operations.md" label="operations" >}} and {{< docs-link product="grid" source="docs/metrics.md" label="control-plane metrics" >}}.

## Versions

The multi-cluster control plane ships from its own repository and release line ({{< product-release product="grid" />}}). The gateway and control-plane releases shown on this site are selected independently and do not form a tested compatibility set; check the control-plane release notes for the gateway versions it was qualified with.
