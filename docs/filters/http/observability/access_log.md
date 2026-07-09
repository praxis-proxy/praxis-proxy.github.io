
# `access_log`

Logs structured access records for each request and response.

## Configuration

| Field | Type | Required | Description |
|-------|------|---------|-------------|
| `sample_rate` | number | no | Fraction of requests to log (0.0, 1.0]. Defaults to 1.0. |

## Example

```yaml
filter: access_log
sample_rate: 0.1   # optional; log ~10% of requests
```

## Related examples
- `examples/configs/observability/access-logging.yaml`
- `examples/configs/observability/logging.yaml`
- `examples/configs/operations/multi-listener.yaml`
- `examples/configs/operations/production-gateway.yaml`
- `examples/configs/pipeline/composed-chains.yaml`
- `examples/configs/pipeline/failure-mode.yaml`
- `examples/configs/protocols/mixed-protocol.yaml`
- `examples/configs/protocols/websocket.yaml`
