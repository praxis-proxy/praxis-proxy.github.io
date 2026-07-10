# `token_count`

Extracts token usage from AI inference responses and writes unified counts to [filter_metadata](/docs/ai/filters/extensions#filter_metadata).

## Configuration Notes

Supports both streaming (SSE) and non-streaming (JSON) responses across all five providers (OpenAI, Anthropic, Google, Bedrock, Azure).

## Configuration

| Field | Type | Required | Description |
|-------|------|---------|-------------|
| `provider` | TokenUsageProvider | yes | AI provider whose response format to parse. |

## Example

```yaml
filter: token_count
provider: openai
```

## Related examples
- [token-counting.yaml](https://github.com/praxis-proxy/ai/blob/main/examples/configs/token-counting.yaml)
