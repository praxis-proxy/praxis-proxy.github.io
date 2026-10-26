+++
title = "Run your first reverse proxy"
description = "Run Praxis and forward a request through a real HTTP backend."
type = "guides"
weight = 10
body_class = "guides-page"
reader_need = "Tutorial"
topic = "First run"
+++

Use Praxis to forward a request to a real HTTP backend. Configure its built-in `router` and `load_balancer` filters in YAML.

You need Docker Engine, `curl`, and an internet connection to pull the two images. The Praxis image listens on container port `8080`; the echo service listens on port `3000`.

## Start the echo service

Create a Docker network so Praxis can reach the echo service by its container name:

```console
docker network create praxis-quickstart
docker run --detach --name praxis-echo \
  --network praxis-quickstart \
  registry.k8s.io/gateway-api/conformance/echo-basic:v0.1.0
```

The echo service listens on port `3000` inside the network. It returns JSON describing the request it received.

## Configure Praxis

Save this as `praxis.yaml` in your current directory:

```yaml
insecure_options:
  allow_private_upstreams: true

listeners:
  - name: web
    address: "0.0.0.0:8080"
    filter_chains: [main]

filter_chains:
  - name: main
    filters:
      - filter: router
        routes:
          - path_prefix: "/"
            cluster: backend
      - filter: load_balancer
        clusters:
          - name: backend
            endpoints:
              - "praxis-echo:3000"
```

`router` matches the request path and selects the `backend` cluster. `load_balancer` connects to the echo container. Docker resolves `praxis-echo` to a private address, so this example enables the global runtime option `allow_private_upstreams`. `allow_private_endpoints` serves a separate config-validation check for literal or recognized private endpoint addresses and is not needed for this Docker hostname. Use the runtime opt-in only in development configurations that need private upstreams.

## Validate and run the proxy

Check the configuration before starting Praxis:

{{< product-release product="praxis" >}}
docker run --rm --network praxis-quickstart \
  --volume "$PWD/praxis.yaml:/etc/praxis/config.yaml:ro" \
  @IMAGE@ --validate
{{< /product-release >}}

Start Praxis and publish its HTTP listener on your machine:

{{< product-release product="praxis" >}}
docker run --rm --name praxis-proxy \
  --network praxis-quickstart \
  --publish 127.0.0.1:8080:8080 \
  --volume "$PWD/praxis.yaml:/etc/praxis/config.yaml:ro" \
  @IMAGE@
{{< /product-release >}}

In another terminal, send a request:

```console
curl -i http://127.0.0.1:8080/
```

The response should have HTTP status `200` and a JSON body that includes the request method `GET` and path `/`. The echo service reports the request it received; values such as host and pod name depend on your Docker environment.

Stop Praxis with Ctrl+C, then remove the echo service and network:

```console
docker rm --force praxis-echo
docker network rm praxis-quickstart
```

Next, [configure built-in filters]({{< relref "use-filters.md" >}}), browse the [versioned configuration examples]({{< relref "../examples/_index.md" >}}), or continue to [operator tasks]({{< relref "operate/_index.md" >}}). For exact fields, {{< docs-link product="praxis" source="docs/filters/reference.md" label="use the filter reference" >}}.
