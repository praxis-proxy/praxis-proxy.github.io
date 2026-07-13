---
sidebar_position: 0
title: Overview
---

# AI Gateway

Praxis AI (`praxis-ai`) is an **AI-native proxy server** and
**AI Gateway** (also deployable as an **AI API Gateway**).
It sits on the path between **workloads and model or agent
backends** to route, manage, enrich, and parse AI traffic.

Core proxy capabilities (router, load balancer, TLS, CORS,
rate limiting) come from [Praxis](/docs/getting-started/product-map).
AI-specific filters register into the same YAML filter pipeline.

## What is an AI Gateway?

An AI Gateway is a dedicated traffic plane for inference and
agentic workloads. Callers may be external clients, in-cluster
applications, or outbound services; backends may be hosted
models, provider APIs, or agent runtimes.

The gateway:

- **Routes** traffic to the right provider or cluster
- **Manages** policy, credentials, rate limits, and health
- **Enriches** prompts and conversation state
- **Parses** request and response bodies (JSON and SSE)

Unlike a generic reverse proxy that forwards on URL and
headers alone, an AI Gateway classifies provider API formats
from request bodies and applies AI-aware policy in the data
plane.

## AI-native proxy server

An **AI-native proxy server** understands AI wire formats
incrementally: OpenAI Responses and Chat Completions,
Anthropic Messages, and agentic JSON-RPC (MCP, A2A). It uses
[StreamBuffer](/docs/architecture/payload-processing) body access
to inspect JSON before upstream selection, handles streaming
SSE responses, and shares facts across filter phases via
[`filter_metadata`](/docs/ai/filters/extensions#filter_metadata).

## Ingress, egress, and in-cluster

The same AI Gateway configuration can run in different
placements:

| Placement | Typical callers | Role |
| --------- | --------------- | ---- |
| **Ingress API gateway** | External clients, partners | North-south entry; auth, routing, observability |
| **Cluster service** | Pods or jobs in Kubernetes (or similar) | Internal `Service` workloads use to reach models |
| **Egress proxy** | Application outbound calls | Enrich and forward inference traffic to external APIs |

```text
  [ Client / Pod / Service ]
            |
            v
     +--------------+
     |  praxis-ai   |  classify, enrich, limit, parse
     +--------------+
            |
     +------+------+------+
     v      v      v      v
  OpenAI  Anthropic  MCP  A2A backends
```

YAML and filter chains are the same; only listener address,
TLS, and upstream clusters change per environment.

## Route, manage, enrich, parse

| Plane | What it does | Examples |
| ----- | ------------ | -------- |
| **Route** | Classify format; pick upstream cluster | `openai_responses_format`, `anthropic_messages_format`, `model_to_header`, `router`, branch chains |
| **Manage** | Policy, limits, credentials, resilience | `credential_injection`, `rate_limit`, `guardrails`, `ip_acl`, health checks, circuit breaker |
| **Enrich** | Prompts, stored state, multi-turn context | `prompt_enrich`, `openai_responses_rehydrate`, `openai_response_store`, `openai_conversations` |
| **Parse** | Bodies, SSE, agentic metadata, usage | StreamBuffer classifiers, `token_count`, `mcp`, `a2a`, `json_rpc` |

See [Features](/docs/getting-started/features#ai-gateway-praxis-ai) for the full filter list.

## Unified AI API Gateway

A single listener can front multiple provider APIs. Classifier
filters promote format and model facts to headers; the router
selects the backend cluster. Example:
[unified-gateway.yaml](https://github.com/praxis-proxy/ai/blob/main/examples/configs/anthropic/unified-gateway.yaml).

## Praxis core vs praxis-ai

| | `praxis` | `praxis-ai` |
| - | -------- | ----------- |
| **Role** | General traffic plane (ingress, egress, load balancing) | AI Gateway on the same runtime |
| **AI filters** | No | Yes (provider APIs, agentic, store, tokens) |
| **Config** | YAML filter chains | Same format |

See [Product map](/docs/getting-started/product-map) for when
to use each binary.

## Guides

- [AI inference pipeline](/docs/ai/ai-inference)
- [OpenAI Responses API](/docs/ai/openai-responses)
- [Anthropic Messages API](/docs/ai/anthropic-messages)
- [Agentic protocols (MCP / A2A)](/docs/ai/agentic-protocols)
- [Response store](/docs/ai/response-store)
- [Token counting](/docs/ai/token-counting)

## Reference

- [AI filter reference](/docs/reference/ai-filters)
- [Per-filter configuration](/docs/ai/filters/reference)

## Source

Develop and contribute in
[github.com/praxis-proxy/ai](https://github.com/praxis-proxy/ai).
