+++
navigation_section = "reference"
title = "Praxis capabilities and support"
description = "What the selected Praxis release supports, gates behind build features, or does not implement."
product = "praxis"
type = "guides"
reader_need = "Reference"
topic = "Capabilities"
order = 10
body_class = "product-overview-page"
+++

{{< release-checked product="praxis" release="v0.8.0" >}}

This page describes the **Praxis {{< product-release product="praxis" />}} default release**. A custom build can omit defaults or add experimental features; check its build and configuration before relying on a capability.

## Protocols

| Capability | Status | Notes |
| --- | --- | --- |
| HTTP reverse proxying | Supported | HTTP/1 and HTTP/2 run on the Pingora network backend, which the default build uses. SSE and gRPC workloads pass through the HTTP proxy; the `grpc_detection` filter classifies content types for pipeline conditions. An experimental hyper backend is available behind the `hyper` build feature and is not at parity with Pingora. |
| TCP forwarding | Supported | TCP listeners forward opaque streams and can use TCP filters. TCP forwarding uses a separate listener mode. |
| WebSocket upgrades | Supported on Pingora | The HTTP proxy preserves validated WebSocket upgrade responses. WebSocket frames pass through without message-aware filtering. The experimental hyper backend does not support upgrades. |
| HTTP/3 / QUIC | Not implemented | The architecture overview lists the QUIC adapter as planned. |
| HTTP CONNECT tunnel | Not implemented | The experimental `forward-proxy` build feature parses and validates a listener `forward_proxy` block, but the CONNECT runtime is not merged, so it accepts no CONNECT requests. The [CONNECT design issue](https://github.com/praxis-proxy/praxis/issues/781) tracks the work. Use a purpose-built forward proxy if clients require `HTTP_PROXY` or `HTTPS_PROXY` tunneling. |

## Configurable operations

| Capability | Default-build status | Enabled by default? |
| --- | --- | --- |
| YAML listeners, routing, and load balancing | Supported | The server can start with a built-in local status response; upstream routing needs a router, a load balancer, and configured clusters. |
| Downstream TLS and upstream TLS | Supported | Configure certificates and TLS settings per listener or cluster. Upstream certificate verification is enabled by default; HTTPS is not implicitly enabled on every listener. |
| TCP TLS and client-certificate checks | Supported | Configure a TCP/HTTP TLS listener and the relevant certificate or peer-identity settings. SPIFFE-specific identity support requires the experimental `spiffe` feature. |
| CORS, rate limiting, ACL, CSRF, and guardrails | Supported filters | No. Add the needed filters to the configured chain; the default config does not apply these policies. |
| Policy engine | Supported filter | The default build compiles the `policy` filter with every Policy builtin; it runs only when a chain configures it. |
| Endpoint health checks and admin health endpoints | Supported | The default build includes `admin-api`, but its listeners bind only when configured: `admin.metrics_address` serves `/healthy`, `/ready`, and `/metrics`, and `admin.address` serves the management API, which must bind to loopback unless `insecure_options.allow_public_admin` is set. |
| Config-file reload | Supported | `config-reload` is enabled in the default build. Some changes need a restart, including listener topology, protocol type, and a bound TCP listener's upstream, cluster, or timeouts. |
| OpenTelemetry tracing | Build-feature dependent | Off by default; compile with `otel` and configure an exporter. |
| Experimental build features | Off by default, except one | Iterative request routing, SPIFFE peer identity, the hyper backend, hedged requests, slow start, and the CONNECT configuration are separate experimental features. The default build includes Policy's experimental rate limiter, so a default binary logs the experimental-features warning at startup; the limiter counts only for a policy that declares it. |

Use {{< docs-link product="praxis" source="docs/operating/build-features.md" label="the complete build-feature reference" >}} and {{< docs-link product="praxis" source="docs/filters/reference.md" label="the filter reference" >}} for exact fields and feature gates. The [operator guides]({{< relref "../guides/operate/_index.md" >}}) link to TLS, health, security, metrics, and reload instructions.

## Project status, compatibility, and license

Praxis is pre-v1. Its [security policy]({{< product-release product="praxis" path="SECURITY.md" />}}) lists every 0.x release as an unsupported alpha and asks for vulnerability reports through GitHub private vulnerability reporting. The workspace uses the Rust lint `unsafe_code = "deny"`, with narrow, explicitly expected SIMD intrinsics; that lint does not describe third-party dependencies or certify the binary.

Praxis v0.8.0 depends on the Praxis Policy Engine crate v0.6.0. The documentation catalog selects Praxis AI {{< product-release product="ai" />}} and Policy {{< product-release product="policy" />}} independently. These project releases are not a tested compatibility matrix; use the dependency versions in the relevant manifests and test the exact builds you combine.

Praxis is licensed under [Apache-2.0]({{< product-release product="praxis" path="LICENSE" />}}). Building from source uses the repository-pinned Rust 1.96.0 toolchain; the manifest MSRV is Rust 1.92+. See the [installation guide]({{< relref "../guides/install.md" >}}) if you need to build it.
