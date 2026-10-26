+++
title = "Choose and configure filters"
description = "Use Praxis’s built-in filters to change how a proxy handles requests."
type = "guides"
weight = 30
body_class = "guides-page"
reader_need = "How-to"
topic = "Configuration"
+++

Praxis applies filters to requests as they pass through a proxy. A filter is a named rule that can forward a request, change a header, or return a response. You choose and configure built-in filters in a YAML file; this does not require writing Rust.

Configure built-in filters in YAML; no Rust code is needed. If you have not run Praxis yet, start with the [first reverse-proxy tutorial]({{< relref "first-proxy.md" >}}). Use the [developer path]({{< relref "extend/_index.md" >}}) for custom filters or features that require a source build.

To adapt a full configuration for another task, browse the [versioned example catalog]({{< relref "../examples/_index.md" >}}).

## Choose a filter

Start with the behavior you need:

- Return a fixed response, for example for a simple status page: use `static_response`.
- Send requests to an application service: use `router` to match the request path and `load_balancer` to choose a service address.
- Add or change request or response headers: use `headers`.
- Apply security checks, rate limits, or logging: choose a matching filter in {{< docs-link product="praxis" source="docs/filters/reference.md" label="the filter reference" >}}.

A **backend** is the application service that receives a proxied request. A **route** is a rule that matches a request and selects a named group of backend addresses. {{< docs-link product="praxis" source="docs/operating/configuration.md" label="The configuration guide" >}} shows how routers and load balancers work together.

## Try a complete configuration

You need Docker Engine and `curl`.

This local example returns a response directly, without contacting a backend. Save it as `praxis.yaml`:

```yaml
listeners:
  - name: local
    address: "0.0.0.0:8080"
    filter_chains: [main]

filter_chains:
  - name: main
    filters:
      - filter: static_response
        status: 200
        body: "Filter configuration is active."
        headers:
          - name: "X-Praxis-Filter"
            value: "configured"
```

`listeners` sets the local address that accepts requests. The filter chain is the ordered list of rules for that listener. Here, `static_response` replies with status `200`, the message, and the `X-Praxis-Filter` header.

Save the file as `praxis.yaml` and validate it:

{{< product-release product="praxis" >}}
docker run --rm \
  --volume "$PWD/praxis.yaml:/etc/praxis/config.yaml:ro" \
  @IMAGE@ --validate
{{< /product-release >}}

Successful validation exits with status `0` and does not start the proxy. Then start it in one terminal:

{{< product-release product="praxis" >}}
docker run --rm --publish 127.0.0.1:8080:8080 \
  --volume "$PWD/praxis.yaml:/etc/praxis/config.yaml:ro" \
  @IMAGE@
{{< /product-release >}}

In another terminal, send a request:

```console
curl -i http://127.0.0.1:8080/
```

The response should have status `200`, include `X-Praxis-Filter: configured`, and contain `Filter configuration is active.` No separate backend is needed for this example.

The proxy listens on this machine at `127.0.0.1:8080`. To forward requests to a service, configure a `router` and `load_balancer` with its address. Praxis blocks loopback, private-network, and link-local upstream addresses by default; the {{< docs-link product="praxis" source="docs/quickstart.md" label="development quickstart" >}} explains the local-development opt-in and its security implications.

## Apply changes safely

Praxis reloads supported filter and routing changes while it runs. If the new configuration is invalid, it logs an error and continues with the last valid configuration. Some settings, including listener addresses, require a restart. Reloading resets the state of rate limiters and circuit breakers. See {{< docs-link product="praxis" source="docs/operating/configuration.md" label="the configuration guide" >}} for the full list.

## When a built-in filter is not enough

If the behavior you need is missing from the reference, it requires custom Rust code and a Praxis build that includes the filter. Developers can follow {{< docs-link product="praxis" source="docs/filters/http-filter-tutorial.md" label="the HTTP filter tutorial" >}} to add a custom filter to their proxy. To contribute a new built-in filter to Praxis itself, use {{< docs-link product="praxis" source="docs/developing/adding-filters.md" label="the built-in filter development guide" >}}.
