
# `static_response`

Returns a fixed response without contacting any upstream.

## Configuration Notes

Useful for health checks, status endpoints, or stub routes. Combine with conditions to serve static responses on specific paths.

## Configuration

| Field | Type | Required | Description |
|-------|------|---------|-------------|
| `body` | string | no | Optional response body string. |
| `headers` | HeaderEntry[] | no | Response headers to include. |
| `headers[].name` | string | yes | Header field name. |
| `headers[].value` | string | yes | Header field value. |
| `status` | integer | yes | HTTP status code to return. |

## Example

```yaml
filter: static_response
status: 200
body: "OK"
```

## Related examples
- `examples/configs/branching/conditional-terminal.yaml`
- `examples/configs/branching/multiple-branches.yaml`
- `examples/configs/branching/nested-branches.yaml`
- `examples/configs/operations/container-default.yaml`
- `examples/configs/operations/hot-reload.yaml`
- `examples/configs/operations/log-overrides.yaml`
- `examples/configs/pipeline/branch-chains.yaml`
- `examples/configs/traffic-management/grpc-detection.yaml`
- `examples/configs/traffic-management/static-response.yaml`
