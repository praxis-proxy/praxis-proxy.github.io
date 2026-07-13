
# `json_body_field`

Extracts top-level fields from a JSON request body and promotes their values to request headers using `StreamBuffer` mode.

## Configuration Notes

If the field is missing or the body is not valid JSON, the filter passes through without modification.

Accepts either single-field syntax (`field` + `header`) or multi-field syntax (`fields` list), but not both.

## Configuration

| Field | Type | Required | Description |
|-------|------|---------|-------------|
| `field` | string | no | Single-field: top-level JSON field name to extract. |
| `header` | string | no | Single-field: request header name to promote into. |
| `fields` | JsonBodyFieldMapping[] | no | Multi-field: list of field-to-header mappings. |
| `fields[].field` | string | yes | Top-level JSON field name to extract. |
| `fields[].header` | string | yes | Request header name to promote the extracted value into. |
| `max_body_bytes` | integer | no | Maximum request body size in bytes for `StreamBuffer` mode. |

## Examples

### Example 1

```yaml
filter: json_body_field
field: model
header: X-Model
```

### Example 2

```yaml
filter: json_body_field
fields:
  - field: model
    header: X-Model
  - field: user_id
    header: X-User-Id
```

## Related examples
- `examples/configs/payload-processing/body-size-limit-with-extraction.yaml`
- `examples/configs/payload-processing/conditional-field-extraction.yaml`
- `examples/configs/payload-processing/field-extraction-access-control.yaml`
- `examples/configs/payload-processing/multi-field-extraction.yaml`
- `examples/configs/payload-processing/multi-listener-body-pipeline.yaml`
- `examples/configs/payload-processing/stream-buffer.yaml`
