+++
title = "Configure and operate Praxis"
description = "Find release-specific guidance for routing, TLS, security, health, observability, and reloads."
type = "guides"
weight = 40
body_class = "guides-page"
+++

Praxis routes HTTP requests through configurable filters and can forward opaque TCP connections with TCP listeners. These guides apply to the selected Praxis documentation release. A configured feature is not automatically enabled: review your YAML and the release's build features.

## Set up traffic

- **Route a request and balance across endpoints:** {{< docs-link product="praxis" source="docs/operating/load-balancing.md" label="routing and load balancing" >}}.
- **Configure one listener, chains, and the full YAML schema:** {{< docs-link product="praxis" source="docs/operating/configuration.md" label="the configuration guide" >}}.
- **Forward an opaque TCP connection:** {{< docs-link product="praxis" source="docs/architecture/tcp-proxy.md" label="the TCP proxy guide" >}}. TCP forwarding uses a separate listener mode. Praxis v0.7.2 does not implement HTTP CONNECT tunneling.

## Protect connections and traffic

- **Terminate downstream TLS, re-encrypt to an upstream, or require client certificates:** {{< docs-link product="praxis" source="docs/operating/tls.md" label="TLS and mTLS" >}}. TLS is configured per listener or upstream; the default config does not enable HTTPS.
- **Apply limits, ACLs, CSRF, or request checks:** {{< docs-link product="praxis" source="docs/operating/security-hardening.md" label="security hardening" >}} and {{< docs-link product="praxis" source="docs/filters/reference.md" label="the filter reference" >}}. These filters are available to configure; they are not all enabled by default.
- **Probe endpoint health and remove unhealthy backends from rotation:** {{< docs-link product="praxis" source="docs/operating/health-checking.md" label="health checks" >}}.

## Observe and update a running proxy

- **Inspect health endpoints, metrics, access logs, and tracing:** {{< docs-link product="praxis" source="docs/operating/observability.md" label="observability" >}}. The default build includes the admin API, but endpoint availability depends on the `admin.address` configuration; OpenTelemetry export requires the `otel` build feature.
- **Validate a configuration and understand reload boundaries:** {{< docs-link product="praxis" source="docs/operating/configuration.md" label="configuration and reload behavior" >}}. Use `praxis --validate --config <file>` before a restart or rollout. Supported config-file changes reload in default builds; listener topology and protocol changes require a restart.
- **Check which functionality your binary includes:** {{< docs-link product="praxis" source="docs/operating/build-features.md" label="the build-feature reference" >}} and the [Praxis v0.7.2 capability matrix]({{< relref "../../praxis/capabilities.md" >}}).

For a running first request, see the [first reverse-proxy tutorial]({{< relref "../first-proxy.md" >}}). To adapt examples to your own service, use the [example catalog]({{< relref "../../examples/_index.md" >}}).
