
# `anthropic_validate`

Validates Anthropic Messages request bodies for proxy-owned JSON envelope requirements.

## Configuration

| Field | Type | Required | Description |
|-------|------|---------|-------------|
| `max_body_bytes` | integer | no | Maximum body size in bytes for `StreamBuffer` mode. |

## Example

```yaml
filter: anthropic_validate
```

## Related examples
- `examples/configs/anthropic/request-validate.yaml`
