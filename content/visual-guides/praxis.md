+++
title = "Praxis request flow"
description = "How filters, listener chains, backend selection, and reload fit together."
type = "guides"
weight = 10
+++

Praxis is a configurable HTTP reverse proxy and TCP forwarding server. This guide answers three operator questions before opening the deeper Rust architecture: what can a filter do to a request, how does configuration connect a listener to a backend, and what changes during reload?

## What does a filter outcome mean?

Request filters run in order. A filter can let the request continue, reject it with an error response, or stop request-filter traversal and proceed to upstream handling. **Terminal** describes the end of that filter traversal; it does not mean that Praxis has already sent the final response.

{{< diagram src="images/guides/core-outcomes.svg" label="Request and response filter outcomes" width="1120" height="450" alt="A request enters a listener and moves through filters. Continue advances to the next filter; Reject returns an error to the client; Terminal stops request-filter traversal and proceeds to upstream handling. Upstream responses pass back through filters that ran, in reverse order." >}}

The response path runs through filters in reverse order, and only filters that ran for the request take part. Branches can also jump ahead or re-enter a chain. {{< docs-link product="praxis" source="docs/architecture/life-of-a-request.md" label="The request lifecycle" >}} defines each outcome; {{< docs-link product="praxis" source="docs/filters/branch-chains.md" label="branch chains" >}} explains conditional paths.

## How do listeners, chains, clusters, and endpoints connect?

A listener binds an address and names one or more filter chains. Praxis flattens those configured chains into the listener's runtime pipeline. A router chooses a named cluster; a load balancer chooses an endpoint in that cluster.

{{< diagram src="images/guides/core-composition.svg" label="Listeners, chains, and backend selection" width="1120" height="430" alt="A listener assembles named filter chains into one ordered runtime pipeline. The router selects a cluster, and the load balancer selects one endpoint from that cluster." >}}

Chain names organize YAML configuration; they are not separate runtime boundaries after the pipeline is built. A cluster is the logical backend group, while its endpoints are the concrete addresses selected for connections. See {{< docs-link product="praxis" source="docs/architecture/pipeline-concepts.md" label="pipeline and chain concepts" >}} and {{< docs-link product="praxis" source="docs/operating/configuration.md" label="the configuration guide" >}}.

## What changes when configuration reloads?

Praxis validates a new configuration and builds a replacement pipeline before swapping it in. Requests already holding the current pipeline finish on that snapshot; later requests use the replacement. If validation fails, the running configuration stays active.

{{< diagram src="images/guides/core-reload.svg" label="Configuration reload and pipeline snapshots" width="1120" height="440" alt="A valid edited configuration is validated, built as a new pipeline snapshot, and swapped in atomically. An in-flight request finishes on the old snapshot, and new requests use the replacement. An invalid configuration leaves the current snapshot in place." >}}

Filter chains, routing rules, and backend endpoints can reload. Listener addresses and protocol types need a restart. Stateful rate-limit and circuit-breaker counters reset when their pipeline is rebuilt. {{< docs-link product="praxis" source="docs/operating/configuration.md" label="The reload reference" >}} lists the exact settings.

## Which filter category fits the task?

Configuration usually selects a built-in filter; Rust code is only needed when the required behavior is missing from the available filters. HTTP filters are grouped by the kind of work they do:

- **Observability** records request details and correlation context.
- **Payload processing** reads or changes bodies.
- **Security** checks access and manages request trust or credentials.
- **Traffic management** routes requests, chooses endpoints, and applies limits.
- **Transformation** changes paths, headers, or protocol data.

TCP filters are grouped under observability and traffic management. Some built-ins require an opt-in build feature; the release-matched {{< docs-link product="praxis" source="docs/filters/reference.md" label="filter reference" >}} lists their categories and feature flags. If no built-in behavior fits, the collapsed developer section below links to extension interfaces.

<details>
<summary>Developer view: where are the runtime boundaries?</summary>
<p>The server resolves each listener's configured chains into a pipeline. Protocol adapters invoke that pipeline from HTTP or TCP callbacks; filters implement the matching extension trait. Pingora owns connection handling, while Praxis owns filter execution and routing decisions.</p>
{{< diagram src="images/guides/core-runtime.svg" label="Praxis runtime boundaries" width="1120" height="400" alt="Pingora invokes an HTTP or TCP protocol adapter. The adapter calls the Praxis pipeline executor, which runs configured built-in or custom filters. Routing filters set the selected upstream, and the adapter asks Pingora to connect and forward traffic." >}}
<p>This website-authored diagram follows the Praxis v0.7.2 <a href="https://github.com/praxis-proxy/praxis/blob/1de023cba3fee967f828c9ff35f27596f8f6792c/docs/architecture/overview.md">runtime overview</a>, <a href="https://github.com/praxis-proxy/praxis/blob/1de023cba3fee967f828c9ff35f27596f8f6792c/docs/architecture/crate-layout.md">crate layout</a>, and <a href="https://github.com/praxis-proxy/praxis/blob/1de023cba3fee967f828c9ff35f27596f8f6792c/docs/filters/README.md">filter interfaces</a>.</p>
<ul>
  <li>{{< docs-link product="praxis" source="docs/architecture/overview.md" label="Runtime architecture" >}}</li>
  <li>{{< docs-link product="praxis" source="docs/architecture/crate-layout.md" label="Crate layout" >}}</li>
  <li>{{< docs-link product="praxis" source="docs/filters/README.md" label="Filter interfaces and built-ins" >}}</li>
  <li>{{< docs-link product="praxis" source="docs/developing/getting-started.md" label="Developer setup" >}}</li>
</ul>
</details>

The diagrams are website-authored explanations based on Praxis v0.7.2 documentation at [commit `1de023cba3fee967f828c9ff35f27596f8f6792c`](https://github.com/praxis-proxy/praxis/tree/1de023cba3fee967f828c9ff35f27596f8f6792c/docs/architecture).
