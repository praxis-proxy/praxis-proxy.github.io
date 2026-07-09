
# `router`

Routes requests to clusters based on path prefix and host header.

## Configuration Notes

If a preceding filter (such as `path_rewrite` or `url_rewrite`) has set `rewritten_path`, the router matches against the rewritten path. Otherwise, it uses the original request path.

Sets `ctx.cluster` for downstream filters but does not pick an endpoint or forward the request. The `load_balancer` filter reads `ctx.cluster` to select an endpoint.

Longest prefix wins. Routes without `host` match any host. Header restrictions use AND semantics with case-sensitive matching.

## Configuration

| Field | Type | Required | Description |
|-------|------|---------|-------------|
| `json_alias_header` | string | no | Header name for the promoted JSON field value during alias resolution. |
| `json_alias_max_body_bytes` | integer | no | Maximum body bytes to buffer when resolving JSON aliases. |
| `routes` | RouterRouteConfig[] | no | Route table entries. |
| `routes[].path` | string | one of | The exact path to match. |
| `routes[].path_prefix` | string | one of | Path prefix. The longest matching prefix wins. |
| `routes[].cluster` | string | yes | Name of the cluster to route matched requests to. |
| `routes[].headers` | ``object<string, string>`` | no | Request headers to match. All specified headers must be present with matching values (AND semantics, case-sensitive). |
| `routes[].host` | string | no | Host to match. If set, the route only applies to this host. |
| `routes[].json_aliases` | JsonAlias[] | no | Optional JSON field aliases evaluated for this route. |
| `routes[].json_aliases[].field` | string | yes | Request JSON field whose string value is compared with `pattern`. |
| `routes[].json_aliases[].match` | string | yes | Exact or single-wildcard pattern for the configured field value. |
| `routes[].json_aliases[].target` | string | no | Replacement value; omitted aliases preserve the original value. |
| `multi_level_subdomain_matching` | bool | no | Enable multi-level subdomain matching for wildcard hosts. When `false` (default), `*.example.com` matches only single-level subdomains like `foo.example.com`. When `true`, it also matches multi-level subdomains like `foo.bar.example.com` (suffix match). Some control planes (e.g. Kubernetes Gateway API) require this. |

## Example

```yaml
filter: router
routes:
  - path_prefix: "/"
    cluster: default
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
