+++
title = "Install and run Praxis"
description = "Install Praxis and send a request through your first proxy."
type = "guides"
weight = 20
body_class = "guides-page"
reader_need = "How-to"
topic = "Installation"
+++

Praxis {{< product-release product="praxis" />}} is the current default documentation release. Use its image for built-in filters and ordinary proxy tasks. Build from source only when developing Praxis or enabling a feature that requires a custom build.

## Choose how to run it

### Container image

Pull the version matching your documentation:

{{< product-release product="praxis" >}}
docker pull @IMAGE@
{{< /product-release >}}

For the FIPS variant of the same release, append `-fips` to the tag:

{{< product-release product="praxis" >}}
docker pull @FIPS_IMAGE@
{{< /product-release >}}

The [Praxis image package](https://github.com/orgs/praxis-proxy/packages/container/package/praxis) lists supported tags and platforms. For FIPS, use the same release tag with `-fips` appended. Praxis AI has its own release numbers; its current documentation release is {{< product-release product="ai" />}}. See the [Praxis AI image package](https://github.com/orgs/praxis-proxy/packages/container/package/ai) for its standard and FIPS image tags.

To check that Praxis is running, start the image:

{{< product-release product="praxis" >}}
docker run --rm --publish 127.0.0.1:8080:8080 @IMAGE@
{{< /product-release >}}

In another terminal, request the default static response:

```console
curl -i http://127.0.0.1:8080/
```

It returns HTTP `200` with `{"status":"ok","server":"praxis"}`. This confirms the proxy is reachable; to forward requests to an application service, use the [first reverse-proxy tutorial]({{< relref "first-proxy.md" >}}). Stop the container with Ctrl+C.

For a custom configuration, set the listener to `0.0.0.0:8080` and mount the file at `/etc/praxis/config.yaml`:

{{< product-release product="praxis" >}}
docker run --rm --publish 127.0.0.1:8080:8080 \
  --volume "$PWD/praxis-container.yaml:/etc/praxis/config.yaml:ro" \
  @IMAGE@
{{< /product-release >}}

An address such as `127.0.0.1` refers to the container itself. Configure an upstream address the container can reach; when Praxis and the backend are both containers, place them on the same Docker network.

### Build from source for development or gated features

Build from source when contributing code or enabling a compile-time feature that the image does not include. Release {{< product-release product="praxis" />}} uses the repository-pinned Rust 1.96.0 toolchain; the source manifest declares Rust 1.92+ as its minimum supported version. It also requires CMake 3.31 or newer, a C/C++ compiler, `pkg-config`, and OpenSSL development headers.

{{< product-release product="praxis" >}}
git clone https://github.com/praxis-proxy/praxis.git
cd praxis
git checkout @VERSION@
cargo build --locked --release -p praxis-proxy
./target/release/praxis --version
{{< /product-release >}}

The binary starts with its built-in local configuration on `127.0.0.1:8080` if you do not pass a config file. That default returns a JSON status response; it is a startup check, not a reverse-proxy example. Use `-c path/to/config.yaml` or `--config path/to/config.yaml` to run your own YAML configuration.

For a real forwarded request, follow the [first reverse-proxy tutorial]({{< relref "first-proxy.md" >}}). It uses a local backend and opts in to private endpoints only for that development setup. Continue with [configuration and operations]({{< relref "operate/_index.md" >}}), or {{< docs-link product="praxis" source="docs/developing/getting-started.md" label="see contributor setup" >}} if you plan to change Praxis itself.
