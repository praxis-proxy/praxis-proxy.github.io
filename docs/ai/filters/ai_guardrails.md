# `ai_guardrails`

Pass-through scaffold for external AI guardrail evaluation.

## Configuration Notes

Buffers request bodies via `StreamBuffer` but does not call the configured provider yet; `on_request_body` returns `Continue` unconditionally. Response-side evaluation is also not wired.

## Configuration

| Field | Type | Required | Description |
|-------|------|---------|-------------|
| `provider` | ProviderConfig | yes | External provider configuration (required). |
| `provider.type` | `nemo` | yes | Provider type selector. |
| `phase` | PhaseConfig | no | Which phases to evaluate. |
| `phase.request` | bool | no | Evaluate client requests before forwarding to the upstream. |
| `phase.response` | bool | no | Evaluate upstream responses before forwarding to the client. |

## Example

```yaml
filter: ai_guardrails
provider:
  type: nemo
  endpoint: "http://nemo:8000/v1/guardrail/checks"
  timeout_ms: 5000
phase:
  request: true
  response: false
```

## Related examples
- [ai-guardrails.yaml](https://github.com/praxis-proxy/ai/blob/main/examples/configs/ai-guardrails.yaml)
