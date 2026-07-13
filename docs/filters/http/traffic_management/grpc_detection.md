
# `grpc_detection`

Detects gRPC requests from the `content-type` header and promotes the variant to filter metadata and results for downstream routing.

## Configuration Notes

Detection values: `grpc` (bare `application/grpc`), `grpc+proto`, `grpc+json`, `grpc+other` (unrecognized sub-protocol), `none` (non-gRPC request).

Writes `grpc_detection.kind` to both filter metadata and filter results for branch chain conditions.

## Example

```yaml
filter: grpc_detection
```

## Related examples
- `examples/configs/traffic-management/grpc-detection.yaml`
