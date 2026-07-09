---
sidebar_position: 1
title: Product Map
---

# Product Map

Praxis ships as two binaries that share the same YAML config
format and filter pipeline.

## `praxis` — core proxy

General-purpose reverse proxy and API gateway.

- HTTP/1.1, HTTP/2, TCP, WebSocket, TLS
- Routing, load balancing, rate limiting, circuit breakers
- Security filters (CORS, CSRF, IP ACL, guardrails)
- Body-based routing (`json_body_field`, `json_rpc`)

```console
cargo run -p praxis-proxy -- -c praxis.yaml
```

Repo: [praxis-proxy/praxis](https://github.com/praxis-proxy/praxis)

## `praxis-ai` — AI gateway

Everything in core, plus AI provider and agentic filters.

- OpenAI Responses API and Conversations
- Anthropic Messages API
- MCP and A2A agent protocols
- Response store (SQLite/PostgreSQL)
- Token counting and usage headers
- External AI guardrails

```console
cargo run -p praxis-ai-proxy -- -c praxis-ai.yaml
```

Repo: [praxis-proxy/ai](https://github.com/praxis-proxy/ai)

## When to use which

| Need | Binary |
| ---- | ------ |
| Generic reverse proxy or API gateway | `praxis` |
| LLM provider routing or unified AI gateway | `praxis-ai` |
| MCP/A2A agent traffic | `praxis-ai` |
| OpenAI Responses stateful flows | `praxis-ai` |

You can run both side by side on different listeners or
merge AI filters into a custom binary via
[extensions](/docs/filters/extensions).

## Next steps

- [Quickstart: praxis](/docs/getting-started/quickstart)
- [Quickstart: praxis-ai](/docs/getting-started/quickstart-ai)
- [Features](/docs/getting-started/features)
