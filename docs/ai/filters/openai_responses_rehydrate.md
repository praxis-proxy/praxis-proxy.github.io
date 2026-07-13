
# `openai_responses_rehydrate`

Validates `previous_response_id` by fetching the stored response, confirming its status is `"completed"`, and populating `ResponsesState` with the full conversation history (stored turns + current input).

## Configuration Notes

The request body is **not** modified; downstream filters read from `ResponsesState.messages` instead.

## Example

```yaml
filter: openai_responses_rehydrate
```

## Related examples
- `examples/configs/openai/responses/full-flow.yaml`
- `examples/configs/openai/responses/rehydrate.yaml`
