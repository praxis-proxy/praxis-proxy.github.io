+++
title = "Operate your gateway"
description = "Make the deployment boundaries explicit before serving application traffic."
type = "guides"
body_class = "guides-page gateway-page"
+++


## Choose the artifact and configuration

Start with the [container quickstart]({{< relref "ai/container-quickstart.md" >}}) and {{< docs-link product="ai" source="docs/release.md" label="AI release documentation" >}}. Pin the artifact you deploy and validate the complete configuration. The linked alpha release is not a blanket production-readiness guarantee.

The [proxy operations guide]({{< relref "guides/operate/_index.md" >}}) covers the underlying runtime. Its standalone proxy release is independently selected: use the gateway's actual dependencies and configuration contract when applying runtime guidance.

## Credentials and endpoint access

Keep provider credentials outside published configurations. Read {{< docs-link product="ai" source="docs/filters/callout_credentials.md" label="callout credential handling" >}} and {{< docs-link product="ai" source="docs/architecture/outbound-callouts.md" label="outbound callout boundaries" >}} for the enabled integrations. Check private-endpoint protections before using internal services; any local-development opt-in needs to stay local.

## Storage and resource limits

{{< docs-link product="ai" source="docs/architecture/response-store.md" label="Response storage" >}} explains persistence and ownership. Review retention, database requirements and recovery for the storage mode you choose. {{< docs-link product="ai" source="docs/capacity-planning.md" label="Capacity planning" >}} covers resource considerations. Include concurrent requests, buffered responses, streaming connections and tool execution in your workload checks.

## Observe the request path

Use {{< docs-link product="ai" source="docs/architecture/opentelemetry.md" label="OpenTelemetry architecture" >}} for tracing and {{< docs-link product="ai" source="docs/filters/time_to_first_token.md" label="time-to-first-token measurement" >}} for the relevant response path. {{< docs-link product="ai" source="docs/filters/external_metering.md" label="External metering" >}} is a configured integration, not an automatic billing guarantee.

## Qualify your composition

Before rollout, exercise authentication failures, upstream errors, timeouts, cancellation, resource exhaustion and any stateful or tool flow your application uses. Check observable responses as well as gateway logs. Repeat those checks when changing providers, filters, build features or versions.

To run gateways across several Kubernetes clusters or regions, add the [multi-region deployment]({{< relref "gateway/multi-region.md" >}}) control plane (technical preview). A single-cluster gateway does not need it.
