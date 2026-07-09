
# `tool_parse`

Parses tool definitions and `tool_choice` from Responses API request bodies and promotes routing facts to metadata and filter results without mutating the body.

## Configuration

| Field | Type | Required | Description |
|-------|------|---------|-------------|
| `max_body_bytes` | integer | no | Maximum body size in bytes for `StreamBuffer` mode. |

## Examples

### Example 1

```yaml
filter: tool_parse
```

### Example 2

```yaml
filter: tool_parse
max_body_bytes: 67108864
```

## Related examples
- `examples/configs/openai/responses/full-flow.yaml`
- `examples/configs/openai/responses/tool-routing.yaml`
