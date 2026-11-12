+++
title = "Run Praxis AI in Docker"
description = "Run Praxis AI in Docker and route an OpenAI request through it."
type = "guides"
body_class = "guides-page"
reader_need = "How-to"
topic = "AI Gateway"
order = 5
product = "ai"
current_release = true
source_path = "website/container-quickstart.md"
summary = "Run Praxis AI in Docker and route an OpenAI request through it."
+++

This guide uses Praxis AI {{< product-release product="ai" />}}. You need Docker Engine with Linux AMD64 support (native or emulated), `curl`, and internet access to pull the image and reach OpenAI.

## Configure the gateway

Save this as `praxis-ai.yaml`:

```yaml
listeners:
  - name: ai
    address: "0.0.0.0:8080"
    filter_chains: [openai]

filter_chains:
  - name: openai
    filters:
      - filter: ai_operation
      - filter: router
        routes:
          - path_prefix: "/v1"
            cluster: openai_backend
      - filter: headers
        request_set:
          - name: Host
            value: api.openai.com
      - filter: load_balancer
        clusters:
          - name: openai_backend
            endpoints:
              - "api.openai.com:443"
            tls:
              sni: "api.openai.com"
```

Validate the configuration with the image matching this documentation release. The published image requires `linux/amd64`; ARM hosts need AMD64 emulation configured in their runtime.

{{< product-release product="ai" >}}
docker run --rm --platform linux/amd64 \
  --volume "$PWD/praxis-ai.yaml:/etc/praxis/praxis-ai.yaml:ro" \
  @IMAGE@ \
  --validate -c /etc/praxis/praxis-ai.yaml
{{< /product-release >}}

Successful validation exits with status `0` without starting the gateway. Then start it with the configuration mounted read-only. The host port is available only on loopback:

{{< product-release product="ai" >}}
docker run --rm --platform linux/amd64 --publish 127.0.0.1:8080:8080 \
  --volume "$PWD/praxis-ai.yaml:/etc/praxis/praxis-ai.yaml:ro" \
  @IMAGE@ \
  -c /etc/praxis/praxis-ai.yaml
{{< /product-release >}}

## Send a request

In another terminal, set your OpenAI API key and send a request through the gateway:

```console
export OPENAI_API_KEY=your-openai-api-key

curl -i http://127.0.0.1:8080/v1/responses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -d '{"model":"gpt-4o","input":"Hello"}'
```

The request uses OpenAI's `gpt-4o` model and needs valid provider credentials, access to that model, and network access from the container. A successful request returns HTTP `200` and a Responses JSON object containing generated output. If the provider returns an error, check its response body, the key, model access, and the proxy logs.

Stop the container with Ctrl+C. Remove the example key from the client shell with `unset OPENAI_API_KEY`, and remove `praxis-ai.yaml` when you no longer need it.
