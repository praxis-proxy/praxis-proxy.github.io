---
title: Token Counting
---

# Token Counting

Extract token usage from AI provider responses and expose it
to clients via response headers.

## Pipeline

Place filters in this order on the response path:

```text
token_count → token_usage_headers
```

1. **`token_count`** reads completed JSON bodies or SSE
   chunks, parses provider-specific usage fields, and writes
   counts to filter metadata.
2. **`token_usage_headers`** reads metadata and injects
   `Praxis-Token-Input`, `Praxis-Token-Output`, and
   `Praxis-Token-Total` on the downstream response.

## Providers

Set `provider` on `token_count` to match your upstream:

| Value | Formats |
| ----- | ------- |
| `openai` | OpenAI Chat Completions, Responses API |
| `anthropic` | Anthropic Messages (JSON and SSE) |
| `google` | Gemini-style usage blocks |
| `bedrock` | AWS Bedrock (Anthropic/OpenAI shapes) |
| `azure` | Azure OpenAI (same JSON as OpenAI) |

## Example

```yaml
filter_chains:
  - name: ai
    filters:
      - filter: openai_responses_format
      - filter: router
        routes:
          - path_prefix: "/v1"
            cluster: backend
      - filter: load_balancer
        clusters:
          - name: backend
            endpoints: ["127.0.0.1:3000"]
      - filter: token_count
        provider: openai
      - filter: token_usage_headers
```

Working configs:

- [token-counting.yaml](https://github.com/praxis-proxy/ai/blob/main/examples/configs/token-counting.yaml)
- [token-usage-headers.yaml](https://github.com/praxis-proxy/ai/blob/main/examples/configs/token-usage-headers.yaml)

## Related

- [Filter reference](/docs/reference/ai-filters)
- [Features](/docs/getting-started/features#security-and-observability)
