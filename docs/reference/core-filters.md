---
title: Core Filter Reference
sidebar_position: 1
---

# Filter Reference

Built-in filters organized by protocol and category.

## HTTP / Observability

| Filter | Feature | Description |
|--------|---------|-------------|
| `access_log`(/docs/filters/http/observability/access_log.md) | - | Logs structured access records for each request and response. |
| `request_id`(/docs/filters/http/observability/request_id.md) | - | Ensures every request carries a correlation ID. |

## HTTP / Payload Processing

| Filter | Feature | Description |
|--------|---------|-------------|
| `compression`(/docs/filters/http/payload_processing/compression.md) | - | Enables Pingora's built-in response compression when present in a filter chain. |
| `json_body_field`(/docs/filters/http/payload_processing/json_body_field.md) | - | Extracts top-level fields from a JSON request body and promotes their values to request headers using `StreamBuffer` mode. |
| `json_rpc`(/docs/filters/http/payload_processing/json_rpc.md) | - | Extracts JSON-RPC 2.0 envelope metadata from request bodies and promotes method, id, and kind to request headers and filter results for routing. |

## HTTP / Security

| Filter | Feature | Description |
|--------|---------|-------------|
| `cors`(/docs/filters/http/security/cors.md) | - | Spec-compliant CORS filter implementing origin validation, preflight handling, and response header injection. |
| `credential_injection`(/docs/filters/http/security/credential_injection.md) | - | Injects per-cluster API credentials into upstream requests. |
| `csrf`(/docs/filters/http/security/csrf.md) | - | CSRF protection filter that validates request origins against a trusted allowlist. |
| `forwarded_headers`(/docs/filters/http/security/forwarded_headers.md) | - | Injects `X-Forwarded-For`, `X-Forwarded-Proto`, and `X-Forwarded-Host` headers into upstream requests. |
| `guardrails`(/docs/filters/http/security/guardrails.md) | - | Rejects requests matching string, regex, or PII rules against headers and/or body content. |
| `ip_acl`(/docs/filters/http/security/ip_acl.md) | - | IP-based access control filter. |
| `policy`(/docs/filters/http/security/policy.md) | `cpex-policy-engine` | Embeds the CPEX policy engine in-process to enforce multi-source JWT identity, APL route policy, RFC 8693 token exchange, PII scanning, audit emission, and (under `body_access: read_write`) request / response body rewriting. |

## HTTP / Traffic Management

| Filter | Feature | Description |
|--------|---------|-------------|
| `circuit_breaker`(/docs/filters/http/traffic_management/circuit_breaker.md) | - | Rejects requests to clusters whose circuit is open. |
| `endpoint_selector`(/docs/filters/http/traffic_management/endpoint_selector.md) | - | Selects an upstream endpoint from a trusted mutation source. |
| `grpc_detection`(/docs/filters/http/traffic_management/grpc_detection.md) | - | Detects gRPC requests from the `content-type` header and promotes the variant to filter metadata and results for downstream routing. |
| `load_balancer`(/docs/filters/http/traffic_management/load_balancer.md) | - | Selects an upstream endpoint using the cluster's configured strategy. |
| `rate_limit`(/docs/filters/http/traffic_management/rate_limit.md) | - | Token bucket rate limiter that rejects excess traffic with 429. |
| `redirect`(/docs/filters/http/traffic_management/redirect.md) | - | Returns a redirect response without contacting any upstream. |
| `router`(/docs/filters/http/traffic_management/router.md) | - | Routes requests to clusters based on path prefix and host header. |
| `static_response`(/docs/filters/http/traffic_management/static_response.md) | - | Returns a fixed response without contacting any upstream. |
| `timeout`(/docs/filters/http/traffic_management/timeout.md) | - | Enforces a maximum end-to-end latency from request receipt to response headers. |

## HTTP / Transformation

| Filter | Feature | Description |
|--------|---------|-------------|
| `headers`(/docs/filters/http/transformation/headers.md) | - | Adds, sets, or removes headers on upstream requests and downstream responses. |
| `path_rewrite`(/docs/filters/http/transformation/path_rewrite.md) | - | Rewrites the request path before forwarding to the upstream. |
| `url_rewrite`(/docs/filters/http/transformation/url_rewrite.md) | - | Rewrites request URLs using regex substitution and query parameter manipulation before the request reaches upstream. |

## TCP / Observability

| Filter | Feature | Description |
|--------|---------|-------------|
| `tcp_access_log`(/docs/filters/tcp/observability/tcp_access_log.md) | - | Logs TCP connection events. |

## TCP / Traffic Management

| Filter | Feature | Description |
|--------|---------|-------------|
| `sni_router`(/docs/filters/tcp/traffic_management/sni_router.md) | - | Routes TCP connections by SNI hostname. |
| `tcp_load_balancer`(/docs/filters/tcp/traffic_management/tcp_load_balancer.md) | - | Selects an upstream TCP endpoint using the cluster's configured strategy. |
