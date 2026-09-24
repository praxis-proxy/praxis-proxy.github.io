---
sidebar_position: 4
title: Features
---

# Features

## Core Architecture

- **Extensible proxy framework** - use one of the
  general-purpose provided builds, or extend your own
  custom proxy server using the Praxis framework.
  Implement the `HttpFilter` or `TcpFilter` trait in your
  own crate and compile for native execution of your
  extensions.
- **Filter pipeline** - configurable chains of filters
  applied to requests and responses
- **Conditional filters** - `when`/`unless` gates on both
  request and response phases (path prefix, methods,
  headers, status codes)

## Traffic Management

- **Path, host, and header routing** - prefix-based
  routing with optional `Host` header and request header
  matching; longest prefix wins
- **Load balancing** - round-robin, least-connections, p2c (power of two choices),
  consistent-hash, weighted endpoints
- **Static responses** - return fixed status, headers,
  and body without upstream
- **Rate limiting** - token bucket rate limiter with
  per-IP and global modes, burst allowance, 429
  responses with `Retry-After`, and `X-RateLimit-*`
  headers
- **Active health checks** - HTTP and TCP health check
  probes with configurable thresholds; unhealthy hosts
  are automatically removed from load balancer rotation
- **Passive health checks** - track upstream failures
  inline; endpoints that exceed a consecutive failure
  threshold are marked unhealthy without dedicated
  probe traffic
- **Circuit breaker** - per-cluster circuit breaker that
  short-circuits requests to failing upstreams with 503,
  then gradually recovers via a half-open probe window
- **Redirect** - return 3xx redirects without upstream;
  supports `${path}` and `${query}` template placeholders
- **Timeout enforcement** - 504 rejection when upstream
  response exceeds a configured latency SLA
- **Endpoint selector** - header-based upstream
  endpoint selection for deterministic routing
- **gRPC detection** - automatic gRPC and gRPC-Web
  content-type detection for protocol-aware handling
- **Iterative request router** - execute sub-requests
  iteratively with failover and circuit breaker
  integration
- **Connection tuning** - per-cluster connection, read,
  write, idle, and total connection (TLS handshake)
  timeouts

## Payload Processing

- **Streaming payload processing**: zero-copy streaming
  by default, opt-in buffered or stream-buffered payload
  access with configurable size limits.
  Stream mode passes chunks through as they arrive
  (lowest latency). StreamBuffer delivers chunks to
  filters
  incrementally but defers upstream forwarding until
  release. See [Payload Processing][payload-processing]
  in the architecture docs.
- **StreamBuffer (peek-then-stream)**: a differentiated
  body access pattern that inspects incoming chunks
  while deferring upstream forwarding until content is
  validated. Filters receive chunks incrementally for
  low-latency inspection, then release the accumulated
  buffer to the upstream. This is the enabling primitive
  for AI inference (model routing from the first few
  KB of the request body), agentic protocol parsing
  (JSON-RPC envelope extraction), and security systems
  (guardrails payload scanning, content classification).
  See the [payload processing][payload-processing]
  docs for the full body access model.
- **Body-based routing**: the built-in `json_body_field`
  filter extracts top-level fields from JSON request
  bodies and promotes values to request headers, enabling
  AI inference model routing, content-based cluster
  selection, and request classification.
- **Prompt enrichment**: inject system or user messages
  into OpenAI-compatible chat completion request bodies
  at the proxy layer. Static configured messages are
  prepended or appended to the `messages` array before
  forwarding upstream.
- **Response compression**: gzip, brotli, and zstd
  response compression with per-algorithm levels,
  content type filtering, and minimum size thresholds.
- **Payload size limits**: global hard ceilings on
  request and response payload size.

[payload-processing]:../architecture/payload-processing

## Security

Security is a primary design constraint. Praxis ships
with secure defaults and fails closed on ambiguous
configuration. See the
[Security Hardening Guide](../security/hardening) for
deployment guidance.

**Build-level guarantees:**

- `unsafe_code = "deny"` in workspace lints
- Rustls (no OpenSSL, no C FFI in the TLS path)
- Supply chain auditing via `cargo audit` and
  `cargo deny`
- Root execution rejected by default

**Configuration-level protections:**

- Listeners default to localhost binding
- Admin endpoints reject public interfaces
- TLS paths reject directory traversal (`..`)
- Health check targets validated against SSRF
  (loopback, link-local, and cloud metadata blocked)
- Upstream TLS verification enabled by default
- Insecure overrides require explicit opt-in and
  emit warnings

**Runtime filters:**

- **CORS**: spec-compliant CORS filter with preflight
  handling, origin validation, wildcard subdomain
  matching, credential support, and Private Network
  Access
- **IP ACL**: allow/deny by source IP/CIDR
- **Guardrails**: reject requests matching header or
  body content via string or regex rules; supports
  negated matching
- **CSRF protection**: origin-based CSRF validation
  with gradual enforcement rollout, `Sec-Fetch-Site`
  support, wildcard subdomains, and log-only mode
- **Forwarded headers**: X-Forwarded-For/Proto/Host
  injection with trusted proxy CIDR support
- **Basic auth**: HTTP Basic Authentication (RFC 7617)
  with configurable credential validation
- **Peer identity trust**: mTLS peer identity
  validation for workload-to-workload authentication

## Observability

- **Request ID** - generate or propagate correlation IDs
  (X-Request-ID by default); echoed in responses
- **Access logging** - structured request/response logging
  via `tracing`
- **Prometheus metrics** - `/metrics` on the admin
  listener exposes request counts and duration
  histograms in Prometheus text exposition format
- **Admin health endpoints** - `/ready` and `/healthy`
  on a dedicated admin listener. `/ready` returns
  per-cluster health status with healthy/unhealthy/total
  counts when active health checks are configured, and
  returns 503 when any cluster has zero healthy
  endpoints

## Request/Response Transformation

- **Header manipulation** - add, set, and remove headers
  on requests and responses
- **Path rewrite** - strip prefix, add prefix, or regex
  replace on request paths; query strings preserved
- **URL rewrite** - regex-based path transformation and
  query string manipulation with ordered operations

## Operations

- **Dynamic configuration reload** - filter pipelines,
  routes, endpoints, health checks, and rate limits
  are swapped atomically at runtime when the config
  file changes. In-flight requests complete on the old
  pipeline; invalid configs are rejected and logged.
  Changes that require a restart (listener topology,
  TLS toggle, protocol type) are detected and logged
  as warnings.
- **Graceful shutdown** - configurable drain timeout
- **Max connections** - per-listener connection limit
  via semaphore; HTTP returns 503 with `Retry-After`,
  TCP closes immediately
- **Runtime tuning** - thread pool sizing and
  work-stealing toggle
- **Runtime key-value stores** - in-memory runtime caches
  created dynamically by filters. Admin API
  (GET/PUT/DELETE) and exact/prefix/suffix/regex match
  types. Pluggable `KvBackend` trait for alternative
  backends. Accessible from all filter contexts. Designed
  for operational overrides (routing tables, feature
  flags), not durable storage.

## Protocols

- **HTTP**: standard HTTP proxying with multiplexing;
  transparent passthrough supports SSE streaming and
  gRPC workloads.
  See [HTTP Connection Lifecycle][http-lifecycle].
- **TLS**:
  - **Termination**: HTTPS on the listener, plain HTTP
    upstream.
  - **Re-encryption**: TLS to upstream with configurable
    SNI.
  - See [TLS documentation][tls-docs].
- **TCP/L4**: bidirectional forwarding with optional TLS
  and idle timeout. See
  [TCP Connection Lifecycle][tcp-lifecycle].
- **Mixed protocols**: HTTP and TCP listeners on a single
  server instance. See
  [Protocol Abstraction][protocol-abstraction].

[http-lifecycle]:../architecture/system-design#http-connection-lifecycle
[tcp-lifecycle]:../architecture/system-design#tcp-connection-lifecycle
[protocol-abstraction]:../architecture/system-design#protocol-adapters
[tls-docs]:../protocols/tls

## AI Inference

Praxis is designed as an AI-native proxy. AI inference
capabilities are built on the [filter pipeline][filters]
and [StreamBuffer][payload-processing] body access
pattern, making them composable with all other filters
rather than bolted-on external processors.

- **Model-based routing** (`model_to_header`): extracts
  the `model` field from JSON request bodies and
  promotes it to an `X-Model` header, enabling
  header-based routing to provider-specific clusters.
  Uses StreamBuffer to inspect the body before upstream
  selection.
- **Credential injection** (`credential_injection`):
  per-cluster API key injection with client credential
  stripping. Supports inline values and environment
  variable sources. Pair with a source discriminator
  (IP ACL, client auth) to control which clients get
  credential upgrades.
- **Prompt enrichment** (`prompt_enrich`): inject
  system or user messages into OpenAI-compatible chat
  completion request bodies at the proxy layer. Static
  configured messages are prepended or appended to the
  `messages` array before forwarding upstream.
- **AI guardrails** (`ai_guardrails`): calls an
  external AI guardrail provider (e.g. NeMo Guardrails)
  to evaluate request bodies. The provider determines
  whether content should be passed, blocked, or
  redacted.
- **Token usage headers** (`token_usage_headers`):
  injects `Praxis-Token-Input`, `Praxis-Token-Output`,
  and `Praxis-Token-Total` headers into downstream
  responses when token usage data is present in filter
  metadata.

### OpenAI Responses API

Full support for the OpenAI Responses API (`/v1/responses`)
through composable filters that handle classification,
validation, conversation state, storage, and streaming.

- **Request classification**
  (`openai_responses_format`): classifies request
  bodies as Responses API, Chat Completions, or
  unknown format. Promotes format, model, stream, and
  routing mode (stateless/stateful) to configurable
  headers, metadata, and filter results for downstream
  routing via branch chains.
- **Request validation**
  (`openai_responses_validate`): validates parameter
  combinations (stream/background, background/store
  conflicts), extracts conversation IDs, and generates
  cryptographically random response and conversation
  IDs with `resp_` and `conv_` prefixes.
- **Model rewrite**
  (`openai_responses_model_rewrite`): rewrites the
  `model` field in request bodies with support for
  default models, exact aliases, and wildcard pattern
  matching.
- **Response rehydration**
  (`openai_responses_rehydrate`): validates
  `previous_response_id` by fetching the stored
  response, confirming its status is `"completed"`,
  and populating `ResponsesState` with the full
  conversation history.
- **Response store** (`openai_response_store`):
  persists non-streaming Responses API responses to
  SQLite or PostgreSQL with tenant isolation, SSRF
  protections, and configurable TLS for database
  connections.
- **Conversation management**
  (`openai_conversations`): handles all
  `/v1/conversations` endpoints locally from the
  configured store without forwarding upstream.
- **Responses proxy** (`responses_proxy`): rebuilds
  the request body from `ResponsesState` when present,
  replacing `input` with the assembled conversation
  history and stripping `previous_response_id` since
  rehydration was handled locally.
- **Stream events** (`openai_stream_events`):
  accumulates state from native Responses API SSE
  event streams with configurable buffer, event, and
  timeout limits.

### Anthropic Messages API

Full support for the Anthropic Messages API
(`/v1/messages`) through five composable filters that
enable passthrough to native backends, passthrough to
`api.anthropic.com`, and bidirectional translation to
OpenAI Chat Completions format.

- **Request classification**
  (`anthropic_messages_format`): classifies requests
  by body structure and promotes routing facts to
  headers, metadata, and filter results. Handles
  ambiguous requests where both Anthropic and Chat
  Completions signals are present.
- **Request validation** (`anthropic_validate`):
  validates the proxy-owned JSON envelope (body
  present, valid JSON, JSON object) before forwarding.
  Backend-owned semantics (model availability, role
  ordering, token limits) are deferred to the backend.
- **Protocol headers**
  (`anthropic_messages_protocol`): injects
  `anthropic-version` header if absent for native
  `/v1/messages` backends.
- **API translation** (`anthropic_to_openai`):
  bidirectional request/response transformation
  between Anthropic Messages and Chat Completions
  wire format. Hoists `system` to an OpenAI system
  message, flattens content blocks, maps
  `stop_sequences` to `stop`, translates tool
  definitions, and transforms responses back.
- **Stream event translation**
  (`anthropic_stream_events`): transforms streaming
  SSE responses between OpenAI and Anthropic formats,
  processing each chunk as it arrives. Arms
  automatically based on upstream classifier metadata
  and response `Content-Type`.

### StreamBuffer as AI Primitive

StreamBuffer is the key differentiator for AI inference
workloads. Traditional proxies operate on headers only,
requiring external processors for body inspection.
Praxis inspects request bodies inline:

1. Buffer the first N bytes (typically the JSON
   envelope containing the model name, parameters,
   and prompt prefix).
2. Extract routing signals (model, provider, token
   budget, tool name).
3. Select the upstream based on body content.
4. Forward the buffered prefix, then stream the
   remainder with zero additional buffering latency.

This peek-then-stream pattern avoids the latency and
operational complexity of external processor
architectures while providing full body visibility
where it matters.

### Planned

The following capabilities are on the roadmap:

- **Provider failover**: ordered failover chains with
  automatic API translation on failure
- **Token-based rate limiting**: per-client token quotas
  with sliding window or token bucket
- **Cost attribution**: token counting mapped to user,
  session, model, and endpoint
- **Semantic caching**: prompt deduplication via vector
  similarity search

## AI Agentic

Praxis provides first-class support for AI agent
protocols, positioning MCP and A2A as headline
capabilities alongside HTTP and TCP proxying.

- **JSON-RPC 2.0 foundation** (`json_rpc`): request
  envelope parsing and method/id extraction for HTTP
  POST bodies, enabling method-based routing for
  MCP/A2A-style traffic. Supports batch policies,
  configurable header names, and invalid-body handling.
- **MCP proxying** (`mcp`): Model Context Protocol
  support with metadata extraction (method, tool/resource
  name, protocol version, session ID), header validation,
  and an optional broker mode with static tool catalog
  aggregation across multiple backend servers.
- **A2A proxying** (`a2a`): Agent-to-Agent protocol
  support with metadata extraction (method, task ID,
  family, streaming flag), task-ownership routing with
  TTL-based expiry, and incremental SSE response
  scanning for streaming A2A methods.

## Praxis AI Extension

AI inference, agentic protocol, and provider API
filters are provided by the
[Praxis AI](https://github.com/praxis-proxy/ai)
extension crate. The AI crate builds on the core
Praxis filter framework and ships as a separate binary
(`praxis-ai`) with all AI filters registered alongside
core filters at startup.

To use AI features, build and run from the
[ai](https://github.com/praxis-proxy/ai) repository
instead of the core praxis binary.

## Extensions

- **Rust extensions**: compile-time custom filters with
  zero overhead via the `HttpFilter`/`TcpFilter` traits
  and `register_filters!` macro.
- **Auto-discovery**: external filter crates
  self-register at build time via
  `[package.metadata.praxis-filters]` in their
  `Cargo.toml`.

[filters]:../filters/filter-model
