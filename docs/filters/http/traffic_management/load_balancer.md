
# `load_balancer`

Selects an upstream endpoint using the cluster's configured strategy.

## Configuration Notes

Supported strategies: - `round_robin` (default): cycles through endpoints in order, respecting weights via endpoint expansion. - `least_connections`: picks the endpoint with the fewest active in-flight requests; decrements the counter on `on_response`. - `consistent_hash`: hashes a configurable request header (or the URI path when the header is absent) to pin requests to a stable endpoint.

## Configuration

| Field | Type | Required | Description |
|-------|------|---------|-------------|
| `clusters` | Cluster[] | no | Cluster definitions. |
| `clusters[].name` | string | yes | Unique name for the cluster. |
| `clusters[].connection_timeout_ms` | integer | no | TCP connection timeout in milliseconds. Applies to the TCP handshake only (before TLS). When exceeded, the connection attempt fails and the load balancer may retry on the next endpoint. `None` (the default) uses Pingora's built-in timeout. |
| `clusters[].endpoints` | (string \| object)[] | yes | List of endpoints for the cluster. Each entry is either a plain `"host:port"` string or a `{ address, weight }` object. |
| `clusters[].endpoints[].address` | string | yes | Socket address as `host:port`. |
| `clusters[].endpoints[].weight` | integer | no | Relative forwarding weight. Higher values receive proportionally more traffic. Defaults to 1. |
| `clusters[].health_check` | HealthCheckConfig | no | Active health check configuration for this cluster. |
| `clusters[].health_check.type` | `http` \| `tcp` \| `grpc` | yes | Probe type: `Http`, `Tcp`, or `Grpc`. |
| `clusters[].health_check.expected_status` | integer | no | Expected HTTP status code for a healthy response. |
| `clusters[].health_check.healthy_threshold` | integer | no | Consecutive successes required to mark an endpoint healthy. |
| `clusters[].health_check.interval_ms` | integer | no | Probe interval in milliseconds. |
| `clusters[].health_check.passive_healthy_threshold` | integer | no | Consecutive successes to mark an endpoint healthy again via passive observation. `None` disables passive recovery (active checks must recover it). |
| `clusters[].health_check.passive_unhealthy_threshold` | integer | no | Consecutive response failures (5xx or connect error) to mark an endpoint unhealthy via passive observation. `None` disables passive checking. |
| `clusters[].health_check.path` | string | no | HTTP path to probe (only used for `http` type). |
| `clusters[].health_check.timeout_ms` | integer | no | Probe timeout in milliseconds. Must be less than `interval_ms`. |
| `clusters[].health_check.unhealthy_threshold` | integer | no | Consecutive failures required to mark an endpoint unhealthy. |
| `clusters[].idle_timeout_ms` | integer | no | Idle connection timeout in milliseconds. Closes pooled upstream connections that have been idle longer than this duration. `None` uses Pingora's default. |
| `clusters[].load_balancer_strategy` | `round_robin` \| `least_connections` \| `p2c` \| `consistent_hash` | no | Load-balancing algorithm for this cluster. Defaults to `round_robin`. |
| `clusters[].max_connections` | integer | no | Maximum concurrent in-flight requests to this cluster. When set, excess requests receive 503. Prevents a single slow upstream from consuming all available capacity. |
| `clusters[].read_timeout_ms` | integer | no | Per-read timeout in milliseconds. Applies to each individual read operation on an established upstream connection. A timeout fires a 502 response to the client. Use `total_connection_timeout_ms` to bound the entire exchange instead. |
| `clusters[].tls` | ClusterTls | no | TLS settings for upstream connections. Presence implies TLS is enabled. Omit for plaintext HTTP. |
| `clusters[].tls.ca` | CaConfig | no | Custom CA. |
| `clusters[].tls.ca.ca_path` | string | yes | Path to the PEM CA certificate file. |
| `clusters[].tls.ca.crl_paths` | string[] | no | Paths to PEM-encoded certificate revocation list (CRL) files. When provided, the mTLS client verifier checks presented client certificates against these CRLs and rejects revoked certificates. |
| `clusters[].tls.client_cert` | CertKeyPair | no | Client certificate for upstream mTLS. |
| `clusters[].tls.client_cert.cert_path` | string | yes | Path to the PEM certificate file. |
| `clusters[].tls.client_cert.default` | bool | no | Whether this certificate is the default fallback for unmatched SNI. At most one certificate in a multi-cert config may set this to `true`. The default entry does not need `server_names`. |
| `clusters[].tls.client_cert.key_path` | string | yes | Path to the PEM private key file. |
| `clusters[].tls.client_cert.server_names` | string[] | no | SNI hostnames this certificate serves (listener only). |
| `clusters[].tls.sni` | string | no | SNI hostname. |
| `clusters[].tls.verify` | bool | no | Verify upstream certificate. |
| `clusters[].total_connection_timeout_ms` | integer | no | Total connection timeout in milliseconds (TCP + TLS). Bounds the combined TCP handshake and TLS negotiation. When exceeded, the connection attempt fails with a 502 response. Prefer this over `connection_timeout_ms` for TLS-enabled clusters where the handshake dominates latency. |
| `clusters[].write_timeout_ms` | integer | no | Per-write timeout in milliseconds. Applies to each individual write operation on an established upstream connection. A timeout fires a 502 response to the client. |

## Example

```yaml
filter: load_balancer
clusters:
  - name: backend
    endpoints: ["10.0.0.1:80"]
```

## Related examples
- `examples/configs/branching/conditional-skip-to.yaml`
- `examples/configs/branching/conditional-terminal.yaml`
- `examples/configs/branching/cross-chain-flat.yaml`
- `examples/configs/branching/multiple-branches.yaml`
- `examples/configs/branching/named-chain-ref.yaml`
- `examples/configs/branching/nested-branches.yaml`
- `examples/configs/branching/reentrance.yaml`
- `examples/configs/branching/unconditional-branch.yaml`
- `examples/configs/observability/access-logging.yaml`
- `examples/configs/observability/logging.yaml`
- `examples/configs/operations/admin-interface.yaml`
- `examples/configs/operations/hot-reload.yaml`
- `examples/configs/operations/max-connections.yaml`
- `examples/configs/operations/multi-listener.yaml`
- `examples/configs/operations/production-gateway.yaml`
- `examples/configs/payload-processing/body-size-limit-with-extraction.yaml`
- `examples/configs/payload-processing/compression.yaml`
- `examples/configs/payload-processing/conditional-field-extraction.yaml`
- `examples/configs/payload-processing/field-extraction-access-control.yaml`
- `examples/configs/payload-processing/multi-field-extraction.yaml`
- `examples/configs/payload-processing/multi-listener-body-pipeline.yaml`
- `examples/configs/payload-processing/stream-buffer.yaml`
- `examples/configs/pipeline/branch-chains.yaml`
- `examples/configs/pipeline/composed-chains.yaml`
- `examples/configs/pipeline/conditional-filters.yaml`
- `examples/configs/pipeline/failure-mode.yaml`
- `examples/configs/protocols/mixed-protocol.yaml`
- `examples/configs/protocols/tls-cipher-suites.yaml`
- `examples/configs/protocols/tls-http-reencrypt.yaml`
- `examples/configs/protocols/tls-mtls-both.yaml`
- `examples/configs/protocols/tls-mtls-listener-request.yaml`
- `examples/configs/protocols/tls-mtls-listener.yaml`
- `examples/configs/protocols/tls-mtls-upstream.yaml`
- `examples/configs/protocols/tls-multi-cert.yaml`
- `examples/configs/protocols/tls-termination.yaml`
- `examples/configs/protocols/tls-verify-disabled.yaml`
- `examples/configs/protocols/tls-version-constraint.yaml`
- `examples/configs/protocols/upstream-ca-file.yaml`
- `examples/configs/protocols/upstream-tls.yaml`
- `examples/configs/protocols/websocket.yaml`
- `examples/configs/security/cors.yaml`
- `examples/configs/security/csrf.yaml`
- `examples/configs/security/downstream-read-timeout.yaml`
- `examples/configs/security/forwarded-headers.yaml`
- `examples/configs/security/guardrails.yaml`
- `examples/configs/security/ip-acl.yaml`
- `examples/configs/security/policy.yaml`
- `examples/configs/traffic-management/basic-reverse-proxy.yaml`
- `examples/configs/traffic-management/canary-routing.yaml`
- `examples/configs/traffic-management/circuit-breaker.yaml`
- `examples/configs/traffic-management/grpc-detection.yaml`
- `examples/configs/traffic-management/health-checks.yaml`
- `examples/configs/traffic-management/hostname-upstream.yaml`
- `examples/configs/traffic-management/hosts.yaml`
- `examples/configs/traffic-management/least-connections.yaml`
- `examples/configs/traffic-management/p2c.yaml`
- `examples/configs/traffic-management/path-based-routing.yaml`
- `examples/configs/traffic-management/rate-limiting.yaml`
- `examples/configs/traffic-management/round-robin.yaml`
- `examples/configs/traffic-management/session-affinity.yaml`
- `examples/configs/traffic-management/timeout.yaml`
- `examples/configs/traffic-management/weighted-load-balancing.yaml`
- `examples/configs/transformation/header-manipulation.yaml`
- `examples/configs/transformation/path-rewriting.yaml`
- `examples/configs/transformation/url-rewriting.yaml`
