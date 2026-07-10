---
title: Openai Responses
---

# OpenAI Responses API

Praxis AI supports the OpenAI Responses API (`/v1/responses`)
and related endpoints through composable filters. Deploy them
in pipeline order: classify, validate, optionally rehydrate
and proxy, then route upstream.

## Filters

| Filter | Phase | Purpose |
| ------ | ----- | ------- |
| `openai_conversations` | Request/response | Local `/v1/conversations` CRUD |
| `openai_responses_format` | Request | Classify format; promote routing headers |
| `openai_responses_validate` | Request | Parameter checks; generate IDs |
| `tool_parse` | Request | Parse tools for branch routing |
| `openai_responses_rehydrate` | Request | Load history from `previous_response_id` |
| `responses_proxy` | Request | Rebuild body from `ResponsesState` |
| `openai_response_store` | Request/response | Persist responses; local GET/DELETE |
| `openai_stream_events` | Request/response | Accumulate streaming SSE events |
| `openai_responses_model_rewrite` | Request body | Rewrite `model` field |

## Minimal gateway

Classify, validate, and route to an OpenAI-compatible backend:

```yaml
listeners:
  - name: gateway
    address: "127.0.0.1:8080"
    filter_chains: [responses]

filter_chains:
  - name: responses
    filters:
      - filter: openai_responses_format
      - filter: openai_responses_validate
      - filter: router
        routes:
          - path_prefix: "/v1"
            cluster: openai
      - filter: load_balancer
        clusters:
          - name: openai
            endpoints: ["api.openai.com:443"]
            tls:
              sni: "api.openai.com"
```

```console
curl -X POST http://127.0.0.1:8080/v1/responses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -d '{"model":"gpt-4o","input":"Hello"}'
```

## Stateful pipeline

For multi-turn traffic with storage and rehydration, see
[full-flow.yaml](https://github.com/praxis-proxy/ai/blob/main/examples/configs/openai/responses/full-flow.yaml).
Typical order:

```text
openai_conversations → openai_responses_format → openai_responses_validate
  → tool_parse → openai_response_store → openai_stream_events
  → openai_responses_rehydrate → responses_proxy → router → load_balancer
```

A request is **stateful** when any of these hold:
`previous_response_id`, non-empty `tools`, `store: true`
(default), `background: true`, `conversation`, or `prompt.id`.

## Related

- [Response store](/docs/ai/response-store)
- [AI inference](/docs/ai/ai-inference)
- [Filter reference](/docs/reference/ai-filters)
- [Example configs](/examples)
