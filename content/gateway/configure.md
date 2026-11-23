+++
title = "Configure gateway behavior"
description = "Choose the request behavior your application needs, then follow the release-specific configuration."
type = "guides"
body_class = "guides-page gateway-page"
+++


## Route requests to models

Use {{< docs-link product="ai" source="docs/filters/provider_route.md" label="provider routing" >}} for backend selection and {{< docs-link product="ai" source="docs/filters/openai_responses_model_rewrite.md" label="Responses model rewriting" >}} when the client-facing model name differs from the upstream name. Check configured fallback and failure behavior; it is not guaranteed by naming multiple providers.

## Add state and tool exchanges

Read {{< docs-link product="ai" source="docs/architecture/response-store.md" label="response storage architecture" >}} before enabling stored Responses or conversations. Use {{< docs-link product="ai" source="docs/filters/openai_agentic_loop.md" label="the agentic loop reference" >}} and {{< docs-link product="ai" source="docs/filters/mcp.md" label="MCP integration" >}} for supported tool exchanges. Configure execution, storage and resource boundaries for the path you enable.

## Apply controls

- {{< docs-link product="ai" source="docs/filters/ai_guardrails.md" label="Guardrail integration" >}}: inspect the configured path and its external service requirements.
- {{< docs-link product="ai" source="docs/filters/token_ceiling.md" label="Token ceilings" >}} and {{< docs-link product="ai" source="docs/filters/token_rate_limit.md" label="token rate limits" >}}: choose request and usage controls.
- {{< docs-link product="ai" source="docs/filters/identity_header_guard.md" label="Identity header protection" >}}: establish the trust boundary for identity supplied in headers.

A filter's presence does not establish complete inspection coverage or equal effectiveness across providers and streaming modes. Validate the composition you run.

## Integrate Policy when needed

[Praxis Policy Engine]({{< relref "policy/_index.md" >}}) remains a separate Rust library and project for authorization, identity, delegation and data controls. Follow the host gateway's integration documentation and dependency versions. The Policy quickstart demonstrates embedding the library; it is not a standalone gateway installation.

## Select build features, then configure runtime behavior

{{< docs-link product="ai" source="docs/features.md" label="Build features and capabilities" >}} explains the selected release. Compile-time selection determines what the binary contains; runtime configuration determines what runs. Disabling a filter in YAML does not remove its implementation or dependencies from the binary.

Find complete source configurations in [the example catalog]({{< relref "examples/_index.md" >}}). Examples identify provenance and prerequisites; their inclusion does not establish that every integration was executed by this website.

Continue with [deployment operations]({{< relref "gateway/operate.md" >}}).
