
# `request_id`

Ensures every request carries a correlation ID.

## Configuration

| Field | Type | Required | Description |
|-------|------|---------|-------------|
| `header_name` | string | no | Name of the header to read, generate, and forward. |

## Example

```yaml
filter: request_id
header_name: X-Correlation-ID   # optional
```

## Related examples
- `examples/configs/branching/conditional-skip-to.yaml`
- `examples/configs/branching/conditional-terminal.yaml`
- `examples/configs/branching/cross-chain-flat.yaml`
- `examples/configs/branching/multiple-branches.yaml`
- `examples/configs/branching/named-chain-ref.yaml`
- `examples/configs/branching/nested-branches.yaml`
- `examples/configs/branching/reentrance.yaml`
- `examples/configs/branching/unconditional-branch.yaml`
- `examples/configs/observability/access-logging.yaml`
- `examples/configs/observability/logging.yaml`
- `examples/configs/operations/hot-reload.yaml`
- `examples/configs/operations/multi-listener.yaml`
- `examples/configs/operations/production-gateway.yaml`
- `examples/configs/pipeline/branch-chains.yaml`
- `examples/configs/pipeline/composed-chains.yaml`
- `examples/configs/protocols/mixed-protocol.yaml`
- `examples/configs/protocols/websocket.yaml`
