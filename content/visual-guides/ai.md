+++
title = "Inside Praxis AI"
description = "Where AI classification and translation fit in the Praxis proxy runtime."
type = "guides"
weight = 20
+++

Praxis AI adds AI API and agent-protocol behavior to the Praxis proxy runtime. This guide answers where those project boundaries sit, then follows one configured translation and failover path. It describes an example configuration; the diagram does not execute requests or measure latency.

## Where does AI-specific behavior sit?

{{< diagram src="images/guides/ai-overview.svg" label="Praxis AI project boundaries" width="1120" height="480" alt="Client protocols enter Praxis AI filters running on the Praxis proxy runtime. Routing selects an inference provider or MCP/A2A backend according to request type. A separate dashed branch connects optional tools and state services." caption="AI behavior runs inside the Praxis proxy runtime. Routing depends on the request type; optional tools and state services are separate integrations." >}}

Praxis AI classifies request format and routing signals, then applies configured AI filters. The Praxis runtime supplies the listener, filter pipeline, routing, and upstream connection. Inference providers are upstreams; MCP/A2A services and response stores are separate integrations. A Policy Engine may be integrated where a deployment needs policy enforcement, but it is an independent project and is not a required stage in every AI request.

This simplified, website-authored diagram follows the [full upstream architecture diagram](https://github.com/praxis-proxy/ai/blob/b9d6016764888e02dc049ec088496b10b7e886c1/assets/praxis-ai-architecture.svg) from Praxis AI v0.4.1, commit `b9d6016764888e02dc049ec088496b10b7e886c1`, licensed under Apache-2.0. Its text equivalent is: client protocols enter AI filters, inference traffic passes through the Praxis runtime to a provider, and optional side integrations connect to tools or state stores.

For focused details, see {{< docs-link product="ai" source="docs/architecture/ai-inference.md" label="inference classification and routing" >}}, {{< docs-link product="ai" source="docs/architecture/agentic-protocols.md" label="MCP and A2A handling" >}}, and {{< docs-link product="ai" source="docs/architecture/response-store.md" label="Responses persistence" >}}. These are separate explanations; the architecture picture does not imply every request uses every integration.

## What happens when a translated request needs failover?

The pinned {{< docs-link product="ai" source="examples/configs/inference/fallback-with-translation.yaml" label="fallback-with-translation example" >}} accepts an OpenAI Responses request and targets Chat Completions-compatible backends. It translates the request before forwarding it. If the primary returns 429, 502, 503, or 504, the iterative router tries the fallback step. A successful primary response skips fallback.

{{< flow-walkthrough >}}

The sample uses placeholder credential values and local endpoints with `allow_private_endpoints: true`; replace these for a real deployment and review the private-endpoint opt-in first. The selected configuration requires the `openai-responses` feature. Its filters are configured behavior; this explanation does not claim that providers, endpoints, or live credentials were exercised.

The sample's per-step classification and validation are deliberate: iterative-router steps reset metadata while retaining extension state, so each step must repopulate the metadata its translation filter reads. See the source-linked {{< docs-link product="ai" source="docs/architecture/ai-inference.md" label="inference guide" >}} for that boundary and the example for exact filter order.

## Separate topics

- {{< docs-link product="ai" source="docs/architecture/agentic-protocols.md" label="MCP and A2A protocols" >}} explains JSON-RPC parsing, tool routing, and task state.
- {{< docs-link product="ai" source="docs/architecture/response-store.md" label="Response storage" >}} explains optional persistence and rehydration.
- {{< docs-link product="ai" source="docs/architecture/postgres-cryptographic-boundary.md" label="The PostgreSQL cryptographic boundary" >}} explains what the database can and cannot observe.

The upstream architecture SVG and the example configuration are Apache-2.0 source assets at the pinned AI v0.4.1 commit above. The walkthrough is a website-authored explanation of those files.
