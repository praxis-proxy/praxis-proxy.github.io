---
sidebar_position: 1
title: Product Map
---

# Product Map

Praxis ships as two binaries that share the same YAML config
format and filter pipeline.

## `praxis` — traffic plane

High-performance **proxy framework** for **ingress** (API
gateway, reverse proxy), **egress** (outbound
service-to-service), and **east/west** (sidecar) deployments.

- HTTP/1.1, HTTP/2, TCP, WebSocket, TLS
- Routing, load balancing, rate limiting, circuit breakers
- Security filters (CORS, CSRF, IP ACL, guardrails)
- Body-based routing (`json_body_field`, `json_rpc`)

```console
cargo run -p praxis-proxy -- -c praxis.yaml
```

Repo: [praxis-proxy/praxis](https://github.com/praxis-proxy/praxis)

## `praxis-ai` — AI Gateway

**AI-native proxy server** and **AI Gateway** (AI API Gateway):
everything in the core traffic plane, plus filters that
**route, manage, enrich, and parse** inference and agentic
traffic. Deploy at the edge, as an in-cluster service, or as
an egress proxy. Full definitions:
[AI Gateway overview](/docs/ai/overview).

- OpenAI Responses API and Conversations
- Anthropic Messages API
- MCP and A2A agent protocols
- Response store (SQLite/PostgreSQL)
- Token counting and usage headers
- AI guardrails (pass-through scaffold today)

```console
cargo run -p praxis-ai-proxy -- -c praxis-ai.yaml
```

Repo: [praxis-proxy/ai](https://github.com/praxis-proxy/ai)

## When to use which

| Need | Binary |
| ---- | ------ |
| Ingress API gateway or general reverse proxy | `praxis` |
| Egress or internal load balancing (non-AI) | `praxis` |
| AI Gateway or AI API Gateway (any placement) | `praxis-ai` |
| In-cluster gateway for pods to reach models | `praxis-ai` |
| MCP/A2A agent traffic | `praxis-ai` |
| OpenAI Responses stateful flows | `praxis-ai` |

You can run both side by side on different listeners or
merge AI filters into a custom binary via
[extensions](/docs/filters/extensions).

## Next steps

- [Quickstart: praxis](/docs/getting-started/quickstart)
- [Quickstart: praxis-ai](/docs/getting-started/quickstart-ai)
- [Features](/docs/getting-started/features)
