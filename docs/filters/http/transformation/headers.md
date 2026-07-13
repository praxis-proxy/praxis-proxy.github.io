
# `headers`

Adds, sets, or removes headers on upstream requests and downstream responses.

## Configuration

| Field | Type | Required | Description |
|-------|------|---------|-------------|
| `request_add` | HeaderPair[] | no | Headers to append to the upstream request. |
| `request_add[].name` | string | yes | Header field name. |
| `request_add[].value` | string | yes | Header field value. |
| `request_remove` | string[] | no | Header names to remove from the upstream request. |
| `request_set` | HeaderPair[] | no | Headers to set on the upstream request (overwrites existing values). |
| `request_set[].name` | string | yes | Header field name. |
| `request_set[].value` | string | yes | Header field value. |
| `response_add` | HeaderPair[] | no | Headers to append to the downstream response. |
| `response_add[].name` | string | yes | Header field name. |
| `response_add[].value` | string | yes | Header field value. |
| `response_remove` | string[] | no | Header names to remove from the downstream response. |
| `response_set` | HeaderPair[] | no | Headers to set on the downstream response (overwrites existing values). |
| `response_set[].name` | string | yes | Header field name. |
| `response_set[].value` | string | yes | Header field value. |

## Example

```yaml
filter: headers
request_add:
  - name: X-Forwarded-By
    value: praxis
request_set:
  - name: X-Custom-Auth
    value: bearer-token
request_remove:
  - X-Internal-Only
response_add:
  - name: X-Frame-Options
    value: DENY
response_remove:
  - X-Backend-Server
response_set:
  - name: Server
    value: praxis
```

## Related examples
- `examples/configs/branching/conditional-skip-to.yaml`
- `examples/configs/branching/cross-chain-flat.yaml`
- `examples/configs/branching/multiple-branches.yaml`
- `examples/configs/branching/named-chain-ref.yaml`
- `examples/configs/branching/nested-branches.yaml`
- `examples/configs/branching/reentrance.yaml`
- `examples/configs/branching/unconditional-branch.yaml`
- `examples/configs/operations/production-gateway.yaml`
- `examples/configs/pipeline/branch-chains.yaml`
- `examples/configs/pipeline/composed-chains.yaml`
- `examples/configs/pipeline/conditional-filters.yaml`
- `examples/configs/traffic-management/path-based-routing.yaml`
- `examples/configs/transformation/header-manipulation.yaml`
