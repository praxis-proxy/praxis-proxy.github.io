+++
title = "Praxis v0.7.2 capabilities and support"
description = "What the selected Praxis release supports, gates behind build features, or does not implement."
product = "praxis"
version = "v0.7.2"
type = "guides"
reader_need = "Reference"
topic = "Capabilities"
order = 10
body_class = "product-overview-page"
+++

This page describes the **Praxis v0.7.2 default release**, pinned to commit [`1de023cba3fee967f828c9ff35f27596f8f6792c`](https://github.com/praxis-proxy/praxis/tree/1de023cba3fee967f828c9ff35f27596f8f6792c). A custom build can omit defaults or add experimental features; check its build and configuration before relying on a capability.

## Protocols

| Capability | v0.7.2 status | Notes |
| --- | --- | --- |
| HTTP reverse proxying | Supported | HTTP/1 and HTTP/2 are handled through the selected Pingora adapter. SSE and gRPC workloads pass through the HTTP proxy; the `grpc_detection` filter classifies content types for pipeline conditions. |
| TCP forwarding | Supported | TCP listeners forward opaque streams and can use TCP filters. TCP forwarding uses a separate listener mode. Praxis v0.7.2 does not implement HTTP CONNECT tunneling. |
| WebSocket upgrades | Supported | The HTTP proxy preserves validated WebSocket upgrade responses. WebSocket frames pass through without message-aware filtering. |
| HTTP/3 / QUIC | Not implemented | The v0.7.2 architecture describes the adapter as planned. |
| HTTP CONNECT tunnel | Not implemented | The open [CONNECT design issue](https://github.com/praxis-proxy/praxis/issues/781) says the current reverse proxy rejects CONNECT. Use a purpose-built forward proxy if clients require `HTTP_PROXY` or `HTTPS_PROXY` tunneling. |

## Configurable operations

| Capability | Default-build status | Enabled by default? |
| --- | --- | --- |
| YAML listeners, routing, and load balancing | Supported | The server can start with a built-in local status response; upstream routing needs a router, a load balancer, and configured clusters. |
| Downstream TLS and upstream TLS | Supported | Configure certificates and TLS settings per listener or cluster. Upstream certificate verification is enabled by default; HTTPS is not implicitly enabled on every listener. |
| TCP TLS and client-certificate checks | Supported | Configure a TCP/HTTP TLS listener and the relevant certificate or peer-identity settings. SPIFFE-specific identity support requires the `spiffe` feature. |
| CORS, rate limiting, ACL, CSRF, and guardrails | Supported filters | No. Add the needed filters to the configured chain; the default config does not apply these policies. |
| Endpoint health checks and admin health endpoints | Supported | The default build includes `admin-api`; configure `admin.address` and health checks as needed. The default config binds admin to loopback. |
| Config-file reload | Supported | `config-reload` is enabled in the default build. Some changes, including listener topology and protocol type, need a restart. |
| OpenTelemetry tracing | Build-feature dependent | Off by default; compile with `otel` and configure an exporter. |
| Iterative request routing and SPIFFE peer identity | Experimental build features | Off by default. Enabling experimental features produces a startup warning; do not assume they are part of the standard binary. |

Use {{< docs-link product="praxis" source="docs/operating/build-features.md" label="the complete build-feature reference" >}} and {{< docs-link product="praxis" source="docs/filters/reference.md" label="the filter reference" >}} for exact fields and feature gates. The [operator guides]({{< relref "../guides/operate/_index.md" >}}) link to TLS, health, security, metrics, and reload instructions.

## Project status, compatibility, and license

Praxis v0.7.2 is pre-v1. Its [security policy](https://github.com/praxis-proxy/praxis/blob/v0.7.2/SECURITY.md) says all 0.x releases are unsupported for security updates. The workspace uses the Rust lint `unsafe_code = "deny"`, with narrow explicitly expected SIMD intrinsics; that lint does not describe third-party dependencies or certify the binary.

Praxis v0.7.2 depends on Praxis Policy Engine crate v0.3.1. The documentation catalog selects Praxis AI v0.7.0 and Policy v0.4.0 independently. These project releases are not a tested compatibility matrix; use the dependency versions in the relevant manifests and test the exact builds you combine.

Praxis is licensed under [Apache-2.0](https://github.com/praxis-proxy/praxis/blob/v0.7.2/LICENSE). Building the v0.7.2 source uses the repository-pinned Rust 1.96.0 toolchain; the manifest MSRV is Rust 1.92+. See the [installation guide]({{< relref "../guides/install.md" >}}) if you need to build it.
