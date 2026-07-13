---
sidebar_position: 1
title: Overview
---

# Configuration

Single YAML file, passed as CLI argument or set via the
`PRAXIS_CONFIG` environment variable. See
[example configs](https://github.com/praxis-proxy/praxis/tree/main/examples/configs) for working examples.

## Structure

```yaml
listeners:             # Required. Named listeners to bind.
filter_chains:         # Named, reusable filter chains.
clusters:              # Optional. Standalone cluster defs (health checks).
admin:                 # Optional. Admin health endpoint.
body_limits:           # Optional. Global body size ceilings.
runtime:               # Optional. Thread pool and logging tuning.
shutdown_timeout_secs: # Optional. Graceful drain time (default: 30).
insecure_options:      # Optional. Dev/test overrides. See /docs/development/testing#insecure-options.
```

## Validating Configuration

Use `--validate` (or `-t`) to check configuration
without starting the server. The flag loads the config
through the same parsing and validation path used
during startup, including filter pipeline construction
and ordering checks.

```console
praxis --validate --config praxis.yaml
praxis -t -c praxis.yaml
```

Exits `0` on success (no output). Exits non-zero and
prints an error to stderr on failure. Does not bind
listener ports or enter the server runtime.

## Dumping Effective Configuration

Use `--dump` (or `-T`) to validate and dump the
effective parsed configuration as YAML to stdout. The
output includes the effective parsed config (with
defaults applied) plus resolved top-level listener
chains.

```console
praxis --dump --config praxis.yaml
praxis -T -c praxis.yaml
```

Exits `0` on valid config, writing YAML to stdout.
Exits non-zero and writes errors to stderr on failure.
Does not start the proxy or bind listeners. `--dump`
and `--validate` are mutually exclusive.

## Dynamic Configuration Reload

Praxis watches the config file for changes and
automatically reloads filter pipelines without restart
or disruption. When the file is modified, the server
validates the new config, rebuilds pipelines, and swaps
them atomically. In-flight requests complete on the old
pipeline; new requests pick up the new config.

If the new config is invalid (bad YAML, unknown filter,
validation failure), the server logs the error and
continues serving with the old config.

**Dynamically reloadable:**

- Filter pipeline configuration
- Router routes and path mappings
- Load balancer endpoints and weights
- Rate limit and circuit breaker settings
- Health check configuration

**Requires restart (logged as warning):**

- Listener add, remove, or address rebind
- Protocol changes (HTTP to TCP)
- Compression module addition
- TLS enable/disable

Stateful filters (rate limiter, circuit breaker) reset
their state on reload. Operators should expect a brief
burst window for rate limiters and a closed circuit for
circuit breakers immediately after reload.

See [hot-reload.yaml](https://github.com/praxis-proxy/praxis/blob/main/examples/configs/operations/hot-reload.yaml) for an example.

## Admin

`admin.address` binds a separate HTTP listener that serves
`/healthy`, `/ready`, and `/metrics`.

- `/healthy` returns `200 OK` with `{"status":"ok"}`
  once the server is accepting connections (liveness).
- `/ready` returns per-cluster health status with
  healthy/unhealthy/total counts when active health
  checks are configured; it returns `503 SERVICE UNAVAILABLE` when any
  cluster has zero healthy endpoints. Without health
  checks, `/ready` returns `{"status":"ok"}`.
- `/metrics` returns Prometheus text exposition format
  with HTTP request metrics (`praxis_http_requests_total`,
  `praxis_http_request_duration_seconds`).

Any other path returns `404 NOT FOUND`. Useful for orchestrator
health checks and monitoring without exposing them on
the main listeners.

```yaml
admin:
  address: "127.0.0.1:9901"
```

When `admin.verbose: true`, the `/ready` response
includes per-cluster detail (cluster names, health
counts). Default is `false` to avoid leaking internal
topology.

```yaml
admin:
  address: "127.0.0.1:9901"
  verbose: true
```

By default, binding admin to a public interface
(`0.0.0.0` / `[::]`) is a validation error.

## Annotated Example

```yaml
listeners:
  - name: web
    address: "0.0.0.0:8080"
    filter_chains:
      - observability
      - routing

filter_chains:
  - name: observability
    filters:
      - filter: request_id
      - filter: access_log

  - name: routing
    filters:
      - filter: router
        routes:
          - path_prefix: "/api/"
            cluster: api
          - path_prefix: "/"
            cluster: web
      - filter: load_balancer
        clusters:
          - name: api
            endpoints: ["127.0.0.1:4000"]
          - name: web
            endpoints:              # multi-line form
              - "127.0.0.1:3000"   # (equivalent to inline
              - "127.0.0.1:3001"   #  array above)
```

## Listeners

Each listener has a required `name`, an `address`, optional
`tls`, optional `protocol` (defaults to `http`), and an
optional list of `filter_chains` to apply. When
`filter_chains` is omitted it defaults to empty (no filters
applied).

```yaml
listeners:
  - name: public
    address: "0.0.0.0:80"
    filter_chains: [main]

  - name: secure
    address: "0.0.0.0:443"
    filter_chains: [main]
    tls:
      certificates:
        - cert_path: /etc/praxis/tls/cert.pem
          key_path: /etc/praxis/tls/key.pem
```

The `name` field uniquely identifies the listener and is
used to resolve its pipeline at startup.

### Network Binding

Binding to `0.0.0.0` or `[::]` exposes the listener
on all network interfaces. For local development,
prefer `127.0.0.1`. In production, bind to specific
internal IPs and use firewall rules to restrict
access. The default configuration binds to
`127.0.0.1:8080` as a security precaution.

### TCP Listeners

TCP listeners set `protocol: tcp` and require an `upstream`
address. Filter chains are optional for TCP listeners.

```yaml
listeners:
  - name: postgres
    address: "0.0.0.0:5432"
    protocol: tcp
    upstream: "10.0.0.1:5432"
```

Optional `tcp_idle_timeout_ms` closes connections that have
been idle longer than the specified duration:

```yaml
listeners:
  - name: postgres
    address: "0.0.0.0:5432"
    protocol: tcp
    upstream: "10.0.0.1:5432"
    tcp_idle_timeout_ms: 300000   # 5 minutes
```

Optional `tcp_max_duration_secs` caps the total session
duration regardless of activity:

```yaml
listeners:
  - name: postgres
    address: "0.0.0.0:5432"
    protocol: tcp
    upstream: "10.0.0.1:5432"
    tcp_max_duration_secs: 3600   # 1 hour
```

### Downstream Read Timeout

Optional `downstream_read_timeout_ms` sets how long the
proxy waits for data from downstream clients during body
reads. Mitigates slow-body attacks on HTTP listeners.

```yaml
listeners:
  - name: web
    address: "0.0.0.0:8080"
    downstream_read_timeout_ms: 10000   # 10 seconds
    filter_chains: [main]
```

Pingora applies its own 60s default for initial request
header reads on fresh connections. This setting controls
body read timeouts within an active request.

### Max Connections

Optional `max_connections` caps concurrent connections
per listener. HTTP listeners reject excess requests
with `503 Service Unavailable` and a `Retry-After: 1`
header. TCP listeners close the socket immediately.

```yaml
listeners:
  - name: public
    address: "0.0.0.0:8080"
    max_connections: 10000
    filter_chains: [main]
```

The limit is enforced via a per-listener semaphore.
Permits are held for the request lifetime (HTTP) or
connection lifetime (TCP) and released automatically on
completion, error, or timeout. Each listener has an
independent limit.

See [max-connections.yaml](https://github.com/praxis-proxy/praxis/blob/main/examples/configs/operations/max-connections.yaml) for an example.

### Mixed Protocols

HTTP and TCP listeners can run on a single server instance.
Each listener gets its own filter chains appropriate to its
protocol.

```yaml
listeners:
  - name: web
    address: "0.0.0.0:8080"
    filter_chains: [routing]

  - name: db
    address: "0.0.0.0:5432"
    protocol: tcp
    upstream: "10.0.0.1:5432"
```

See [TLS & mTLS](/docs/protocols/tls) for TLS details.

## Filter Chains

Named filter chains are defined at the top level. Each chain
has a `name` and an ordered list of `filters`. Listeners
reference chains by name via `filter_chains:`.

```yaml
filter_chains:
  - name: security
    filters:
      - filter: headers
        response_set:
          - name: "X-Content-Type-Options"
            value: "nosniff"

  - name: observability
    filters:
      - filter: request_id
      - filter: access_log

  - name: routing
    filters:
      - filter: router
        routes:
          - path_prefix: "/"
            cluster: backend
      - filter: load_balancer
        clusters:
          - name: backend
            endpoints: ["10.0.0.1:8080"]
```

### Chain Composition

A listener can reference multiple chains. The filters from
each chain are concatenated in order to form the listener's
complete pipeline. This enables reuse without duplication.

```yaml
listeners:
  - name: public
    address: "0.0.0.0:8080"
    filter_chains:
      - security
      - observability
      - routing

  - name: internal
    address: "0.0.0.0:9090"
    filter_chains:
      - observability
      - routing
```

The public listener runs security + observability + routing.
The internal listener skips security but shares the same
observability and routing chains.

### Protocol Compatibility

Filters are protocol-aware. HTTP filters (e.g. `router`,
`load_balancer`) only work on HTTP listeners. TCP filters
(e.g. `tcp_access_log`) work on both HTTP and TCP listeners.
An HTTP listener's protocol stack includes TCP, so it
supports TCP-level filters too.

## Built-in Filters

Core filters ship with the `praxis` binary. AI filters
require `praxis-ai` — see [AI filter reference](/docs/reference/ai-filters).

Full core reference: [core filter reference](/docs/reference/core-filters).

| Filter | Category | Protocol |
| --- | --- | --- |
| `router` | Traffic Management | HTTP |
| `load_balancer` | Traffic Management | HTTP |
| `timeout` | Traffic Management | HTTP |
| `static_response` | Traffic Management | HTTP |
| `rate_limit` | Traffic Management | HTTP |
| `circuit_breaker` | Traffic Management | HTTP |
| `grpc_detection` | Traffic Management | HTTP |
| `headers` | Transformation | HTTP |
| `request_id` | Observability | HTTP |
| `access_log` | Observability | HTTP |
| `tcp_access_log` | Observability | TCP |
| `forwarded_headers` | Security | HTTP |
| `guardrails` | Security | HTTP |
| `ip_acl` | Security | HTTP |
| `credential_injection` | Security | HTTP |
| `json_body_field` | Payload Processing | HTTP |
| `json_rpc` | Payload Processing | HTTP |
| `compression` | Payload Processing | HTTP |
| `cors` | Security | HTTP |
| `csrf` | Security | HTTP |
| `redirect` | Traffic Management | HTTP |
| `path_rewrite` | Transformation | HTTP |
| `url_rewrite` | Transformation | HTTP |
| `sni_router` | Traffic Management | TCP |
| `tcp_load_balancer` | Traffic Management | TCP |

## Filter Configuration

Per-filter fields, defaults, and YAML examples live in the
[core filter reference](/docs/reference/core-filters). Each
filter has a dedicated page under `docs/filters/http/` and
`docs/filters/tcp/`.

AI filters (`model_to_header`, `mcp`, OpenAI Responses, and
others) require `praxis-ai` — see
[AI filter reference](/docs/reference/ai-filters).

## Cluster Load Balancing

### Load Balancing

Strategies:

- `round_robin` (default): cycles through endpoints
- `least_connections`: picks endpoint with fewest active
  requests
- `consistent_hash`: hashes a request header (or URI path
  as fallback) to pin requests to stable endpoints

Example configs: [weighted-load-balancing.yaml](https://github.com/praxis-proxy/praxis/blob/main/examples/configs/traffic-management/weighted-load-balancing.yaml),
[least-connections.yaml](https://github.com/praxis-proxy/praxis/blob/main/examples/configs/traffic-management/least-connections.yaml), [session-affinity.yaml](https://github.com/praxis-proxy/praxis/blob/main/examples/configs/traffic-management/session-affinity.yaml).

Cluster-level options: `connection_timeout_ms`,
`total_connection_timeout_ms`, `idle_timeout_ms`,
`read_timeout_ms`, `write_timeout_ms`, `tls`.

`total_connection_timeout_ms` sets the combined budget for
TCP connect and TLS handshake. When used alongside
`connection_timeout_ms`, the difference is effectively the
TLS handshake budget. It must be >= `connection_timeout_ms`.

Cluster `tls` enables TLS to the upstream. See
[TLS & mTLS](/docs/protocols/tls) for full details on upstream TLS, mTLS,
CA trust, and certificate verification.

#### Health Checks

Clusters support active health checks via the
`health_check` field. Endpoints that fail consecutive
probes are removed from load balancer rotation until they
recover. See [health-checks.yaml](https://github.com/praxis-proxy/praxis/blob/main/examples/configs/traffic-management/health-checks.yaml).

| Field | Type | Default | Description |
| ----- | ---- | ------- | ----------- |
| `type` | string | required | `"http"` or `"tcp"` (`"grpc"` parses but is not yet supported) |
| `path` | string | `"/"` | HTTP path to probe (HTTP only) |
| `expected_status` | integer | 200 | Expected HTTP status code |
| `interval_ms` | integer | 5000 | Probe interval in ms |
| `timeout_ms` | integer | 2000 | Per-probe timeout in ms |
| `healthy_threshold` | integer | 2 | Consecutive successes to mark healthy |
| `unhealthy_threshold` | integer | 3 | Consecutive failures to mark unhealthy |
| `passive_unhealthy_threshold` | integer | none | Consecutive upstream failures (5xx or connect error) to mark unhealthy without probes |
| `passive_healthy_threshold` | integer | none | Consecutive upstream successes to recover a passively-marked endpoint |

TCP health checks only verify a TCP connection can be
established; `path` and `expected_status` are ignored.
When active health checks are configured, the admin
`/ready` endpoint reports per-cluster health counts.

Passive health checking tracks upstream request
outcomes inline. When `passive_unhealthy_threshold` is
set, endpoints that return consecutive 5xx responses or
connect errors are marked unhealthy without dedicated
probe traffic. Set `passive_healthy_threshold` to
control how many consecutive successes are required to
recover. Passive and active checks can be used together;
either mechanism can mark an endpoint unhealthy, and
either can recover it.

By default, health check endpoints that resolve to
loopback, link-local, or cloud metadata addresses are
rejected (SSRF protection).

### Conditions

`when`/`unless` gates on any filter chain entry. Request
predicates: `path` (exact match), `path_prefix`,
`methods`, `headers`. All fields within a condition are
ANDed. Use `response_conditions` with `status` or
`headers` predicates to gate response hooks. See
[conditional-filters.yaml](https://github.com/praxis-proxy/praxis/blob/main/examples/configs/pipeline/conditional-filters.yaml).

Request conditions gate both request and body hooks.
Response conditions gate only `on_response` and response
body hooks. A filter can have both `conditions` and
`response_conditions`.

## Payload Size Limits

Global hard ceilings on request and response payload
size. These apply across all body modes (Stream,
StreamBuffer). When a filter also declares a per-filter
`max_bytes`, the smaller of the two limits is enforced.
Requests exceeding the limit receive 413 (Payload Too
Large).

```yaml
body_limits:
  max_request_bytes: 10485760    # 10 MiB
  max_response_bytes: 5242880    # 5 MiB
```

Both default to 10 MiB (10,485,760 bytes) when
omitted. Setting either to `null` removes the ceiling
but requires `insecure_options.allow_unbounded_body:
true`; without that flag, startup fails with a
validation error.

## Header and Request Limits

Praxis inherits header and request limits from Pingora's
HTTP/1.x parser. These are compile-time constants in
Pingora and are not currently configurable in Praxis.

| Limit | Value | Notes |
| ------- | ------- | ------- |
| Max total header size | 1,048,575 B (~1 MiB) | Includes request line |
| Max number of headers | 256 | HTTP/1.x only |
| Request-URI max size | shared with header limit | No separate cap |
| Header read timeout | 60 s | Pingora default |
| Body buffer chunk | 65,536 B (64 KiB) | Per-read buffer |

HTTP/2 header limits are governed by the `h2` crate's
HPACK and frame-level settings (typically 16 KiB for
HEADERS frames by default, negotiated via SETTINGS).

Requests that exceed header size or count limits receive
a 400 Bad Request from Pingora before reaching the filter
pipeline.

## Runtime

Worker thread pool and scheduling configuration.

```yaml
runtime:
  threads: 8             # 0 = auto-detect (default)
  work_stealing: true    # default: true
```

- `threads`: number of worker threads per service.
  When set to 0 (the default), the thread count is
  auto-detected from available CPUs.
- `work_stealing`: allow work-stealing between worker
  threads of the same service. Enabled by default.
- `global_queue_interval`: fixed global queue interval
  for the tokio scheduler. `Option<u32>`, defaults to
  `Some(61)`. Set to `null` to use tokio's default.
- `upstream_keepalive_pool_size`: maximum number of idle
  upstream connections kept per thread. `Option<usize>`,
  defaults to `Some(64)`. Set to `null` to disable
  keepalive pooling.

```yaml
runtime:
  threads: 4
  work_stealing: true
  global_queue_interval: 61
  upstream_keepalive_pool_size: 64
```

### Upstream CA

`upstream_ca_file` sets a PEM CA file used as the root
certificate store for all upstream TLS connections.
Per-cluster `tls.ca` overrides this for individual
clusters.

```yaml
runtime:
  upstream_ca_file: /etc/praxis/tls/internal-ca.pem
```

This **replaces** the system trust store (not additive).
See [TLS & mTLS](/docs/protocols/tls) for details on CA trust
precedence and combined bundles.

### Logging

Set `PRAXIS_LOG_FORMAT=json` to emit structured JSON log
output instead of the default human-readable format.

Per-module log level overrides can be configured under
`runtime.log_overrides`:

```yaml
runtime:
  log_overrides:
    praxis_filter::pipeline: trace
    praxis_protocol: debug
```

This is useful for debugging a specific subsystem without
flooding output from every module.

## Key-Value Stores

In-memory key-value stores for runtime-updatable
mappings. Stores are created dynamically by filters
at runtime via `KvStoreRegistry::get_or_create` and
managed through the admin API. No YAML configuration
is required.

Filters access stores by name through
`HttpFilterContext` and `TcpFilterContext`.

### Match Types

Stores support four match types for key lookup:

| Type | Behavior |
| ---- | -------- |
| `exact` | Key must equal the lookup key |
| `prefix` | Stored key starts with the pattern |
| `suffix` | Stored key ends with the pattern |
| `regex` | Stored key matches a regex pattern |

### Admin API

When `admin.address` is configured, CRUD endpoints
are available:

| Method | Path | Description |
| ------ | ---- | ----------- |
| `GET` | `/api/kv/{store}` | List all entries |
| `GET` | `/api/kv/{store}/{key}` | Get a value |
| `PUT` | `/api/kv/{store}/{key}` | Set a value (body) |
| `DELETE` | `/api/kv/{store}/{key}` | Delete a key |

Writes are immediately visible to all filters on all
threads. Unknown store names return 404.

### Runtime Cache Semantics

Key-value stores are **runtime caches, not durable
storage**. Data lives in memory and is lost on process
exit.

The store is designed for operational overrides (routing
tables, feature flags, config knobs) that can be
reconstructed from an external source of truth. Do not
use it as a primary data store.

### Pluggable Backends

The `KvBackend` trait allows alternative implementations
(e.g. Redis). The default `InMemoryKvBackend` uses
DashMap for lock-free reads. See the `praxis_core::kv`
module docs for the trait definition.

## Graceful Shutdown

The `shutdown_timeout_secs` field controls how long the
server drains in-flight connections before forcing
shutdown:

```yaml
shutdown_timeout_secs: 60    # default: 30
```

## Default Configuration

When no configuration file is provided, Praxis starts with
a built-in default config that listens on `127.0.0.1:8080`
and responds with `{"status": "ok", "server": "praxis"}`
on `/` (exact match) and 404 elsewhere. The default binds
to localhost only, preventing accidental exposure to
public networks during initial setup. This allows zero
config startup for testing. The source lives in
[default.yaml](https://github.com/praxis-proxy/praxis/blob/main/core/src/config/default.yaml). For a realistic starting point, see
[basic-reverse-proxy.yaml](https://github.com/praxis-proxy/praxis/blob/main/examples/configs/traffic-management/basic-reverse-proxy.yaml).

## Example Configs

Working examples live under `examples/configs/`, organized
by category:

| Directory | Contents |
| ----------- | ---------- |
| `ai` | AI inference model-to-header routing |
| `traffic-management` | Router, load balancer, timeouts, static responses, redirects, rate limiting, health checks |
| `payload-processing` | Body processing: compression, field extraction, stream buffering, size limits |
| `security` | Forwarded headers, IP ACL, guardrails, CORS, downstream read timeout |
| `observability` | Access logs, request IDs |
| `transformation` | Header manipulation, path rewriting, URL rewriting |
| `protocols` | TCP, TLS, mixed protocol configs |
| `pipeline` | Filter chain composition and conditions |
| `operations` | Production gateway, multi-listener, admin |

## Validation and Security

Praxis validates configuration at startup and fails
closed. Ambiguous or risky settings are errors, not
warnings. Insecure overrides (see [Testing](/docs/development/testing))
require explicit opt-in and emit warnings at startup.

Key validations: listener name uniqueness, filter chain
reference resolution, TLS path traversal rejection,
admin endpoint binding restrictions, health check SSRF
protection, upstream TLS SNI requirements, and payload
size enforcement.

## Error Behavior

Praxis fails fast at startup for configuration problems.
Common failure modes:

- **Invalid YAML or missing required fields**: the process
  exits with a descriptive error before any listener binds.
- **Unknown filter chain reference**: a listener references
  a chain name not defined in `filter_chains:`; caught at
  config validation.
- **TLS certificate load failure**: the process exits if
  a certificate's `cert_path` or `key_path` cannot be
  read or parsed.
- **Address bind failure**: if the listen address is already
  in use or invalid, the server fails to start.

At runtime:

- **Unreachable upstream**: the request returns 502 (Bad
  Gateway). Connection timeouts are configurable per
  cluster.
- **Filter error**: an `Err` from a filter results in a
  500 response to the client. The error is logged.
- **Payload too large**: exceeding
  `body_limits.max_request_bytes` or a filter's
  `max_bytes` returns 413.

## Overrides

Some validations and features can be overridden for development
and testing purposes. See `insecure_options` in [Testing](/docs/development/testing#insecure-options).
