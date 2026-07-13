---
title: AI Filter Reference
sidebar_position: 2
---

# Filter Reference

AI filters provided by Praxis AI. For base proxy
filters (router, load balancer, headers, CORS, etc.),
see the [Praxis core filter reference][core-ref].

[core-ref]: /docs/reference/core-filters

## Provider APIs (praxis-ai-apis)

### Anthropic

| Filter | Description |
|--------|-------------|
| [`anthropic_messages_format`](/docs/ai/filters/anthropic_messages_format) | Classifies Anthropic Messages API requests and promotes routing facts to headers, metadata, and filter results. |
| [`anthropic_messages_protocol`](/docs/ai/filters/anthropic_messages_protocol) | Normalizes Anthropic Messages protocol headers for native backends. |
| [`anthropic_stream_events`](/docs/ai/filters/anthropic_stream_events) | Transforms streaming SSE responses between `OpenAI` and Anthropic formats, processing each chunk as it arrives. |
| [`anthropic_to_openai`](/docs/ai/filters/anthropic_to_openai) | Transforms Anthropic Messages API requests to Chat Completions-compatible request bodies and transforms compatible responses back. The filter name refers to the OpenAI Chat Completions wire shape, not the Responses API; non-OpenAI compatible backends are valid targets. |
| [`anthropic_validate`](/docs/ai/filters/anthropic_validate) | Validates Anthropic Messages request bodies for proxy-owned JSON envelope requirements. |

### OpenAI

| Filter | Description |
|--------|-------------|
| [`openai_conversations`](/docs/ai/filters/openai_conversations) | Handles all `/v1/conversations` endpoints locally. |
| [`openai_response_store`](/docs/ai/filters/openai_response_store) | Persists Responses API responses to the configured response store backend. |
| [`openai_responses_format`](/docs/ai/filters/openai_responses_format) | Classifies AI API request bodies and promotes routing facts to headers, metadata, and filter results without mutating the body. |
| [`openai_responses_model_rewrite`](/docs/ai/filters/openai_responses_model_rewrite) | Rewrites the `model` field in Responses API request bodies. |
| [`openai_responses_rehydrate`](/docs/ai/filters/openai_responses_rehydrate) | Validates `previous_response_id` by fetching the stored response, confirming its status is `"completed"`, and populating `ResponsesState` with the full conversation history (stored turns + current input). |
| [`openai_responses_validate`](/docs/ai/filters/openai_responses_validate) | Validates and enriches Responses API requests. |
| [`openai_stream_events`](/docs/ai/filters/openai_stream_events) | Accumulates state from native Responses API SSE event streams. |
| [`responses_proxy`](/docs/ai/filters/responses_proxy) | Rebuilds the request body from `ResponsesState` when present. |
| [`tool_parse`](/docs/ai/filters/tool_parse) | Parses tool definitions and `tool_choice` from Responses API request bodies and promotes routing facts to metadata and filter results without mutating the body. |

## Cross-Provider Filters (praxis-ai-filters)

### Agentic

| Filter | Description |
|--------|-------------|
| [`a2a`](/docs/ai/filters/a2a) | Extracts A2A protocol metadata from JSON-RPC request bodies and promotes method, family, task ID, streaming detection, and version to request headers, filter results, and durable metadata for routing. |
| [`mcp`](/docs/ai/filters/mcp) | Extracts MCP protocol metadata from JSON-RPC request bodies and promotes method, tool/resource/prompt name, JSON-RPC kind, protocol version, and session presence to request headers/filter results; stores session ID in durable metadata. |

### Guardrails

| Filter | Description |
|--------|-------------|
| [`ai_guardrails`](/docs/ai/filters/ai_guardrails) | Pass-through scaffold for external AI guardrail evaluation. |

### Inference

| Filter | Description |
|--------|-------------|
| [`model_to_header`](/docs/ai/filters/model_to_header) | Promotes the JSON `"model"` field from the request body to a request header. |

### Prompt Enrich

| Filter | Description |
|--------|-------------|
| [`prompt_enrich`](/docs/ai/filters/prompt_enrich) | Injects statically configured messages into the `messages` array of OpenAI-compatible chat completion request bodies. |

### Token Count

| Filter | Description |
|--------|-------------|
| [`token_count`](/docs/ai/filters/token_count) | Extracts token usage from AI inference responses and writes unified counts to [filter_metadata](/docs/ai/filters/extensions#filter_metadata). |

### Token Usage

| Filter | Description |
|--------|-------------|
| [`token_usage_headers`](/docs/ai/filters/token_usage_headers) | Injects `Praxis-Token-Input`, `Praxis-Token-Output`, and `Praxis-Token-Total` headers into downstream responses when token usage data is present in [filter_metadata](/docs/ai/filters/extensions#filter_metadata). |
