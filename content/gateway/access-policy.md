+++
title = "Access policy"
description = "Decide which user, agent or workload may call which model, tool or resource, and what data may flow back."
type = "guides"
body_class = "guides-page gateway-page"
+++

{{< release-checked product="praxis" release="v0.8.0" >}}
{{< release-checked product="policy" release="v0.7.0" >}}

Access policy is the gateway's authorization layer. The `policy` filter runs the policy engine in-process, on the request path: it verifies each caller's identity, evaluates your policy document against the operation, and applies the result before the request reaches an upstream.

## What it controls

- **Identity**: validate user, agent and workload tokens from separate headers and map their claims into attributes.
- **Authorization**: gate tool, prompt, resource and model calls by role, attribute, or a decision from Cedar, CEL or OPA. Unknown or ambiguous models fail closed by default.
- **Delegation**: mint audience-scoped upstream credentials with token exchange (RFC 8693).
- **Data controls**: apply session taint that outlives one call, request human approval, and emit an audit event per decision. Field mutators such as `redact()` only take effect with `body_access: read_write`; the default `read_only` discards them. Even with `read_write`, they rewrite JSON-RPC tool, prompt and resource bodies, not inference request or response bodies.

## Enable it

The filter is registered as `policy` and needs the `policy-engine` build feature; the default build includes it and its builtin plugins. Read {{< docs-link product="praxis" source="docs/filters/http/security/policy.md" label="the policy filter reference" >}} for configuration and filter ordering, then {{< docs-link product="policy" source="docs/content/quickstart.md" label="write a first policy" >}}.

Common tasks:

- {{< docs-link product="policy" source="docs/content/llm-routes.md" label="Authorize model routes" >}}
- {{< docs-link product="policy" source="docs/content/http-routing.md" label="Authorize HTTP routes" >}}
- {{< docs-link product="policy" source="docs/content/identity-delegation.md" label="Identity and token exchange" >}}
- {{< docs-link product="policy" source="docs/content/testing.md" label="Test policies" >}} and {{< docs-link product="policy" source="docs/content/auditing.md" label="audit decisions" >}}

The policy language is documented in the reference section, starting with {{< docs-link product="policy" source="docs/content/apl/index.md" label="the language overview" >}}.

## The engine contract

Filters and extensions talk to the engine through a typed contract: the {{< docs-link product="policy" source="docs/content/cmf.md" label="Common Message Format" >}}, {{< docs-link product="policy" source="docs/content/assertions.md" label="the assertions wire contract" >}} and {{< docs-link product="policy" source="docs/content/extensions.md" label="capability-gated extensions" >}}. You only need these pages to extend the gateway or embed the engine in another Rust host; they are listed under Extend.

## Versions

The policy engine is versioned in its own repository ({{< product-release product="policy" />}}). The gateway pins the engine version it compiles in; the engine release shown on this site is selected independently and is not a tested combination with the gateway release shown alongside it.
