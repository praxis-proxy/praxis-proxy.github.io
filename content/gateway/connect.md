+++
title = "Connect applications and providers"
description = "Choose an API path, then check its backend, authentication and compatibility requirements."
type = "guides"
body_class = "guides-page gateway-page"
+++


[Run the gateway first]({{< relref "ai/container-quickstart.md" >}}) if you have not sent a request yet.

## OpenAI Responses and conversation state

Start with {{< docs-link product="ai" source="docs/features.md" label="the capability overview" >}} to distinguish provider forwarding from managed API behavior. For managed Responses, read {{< docs-link product="ai" source="docs/filters/openai_responses_proxy.md" label="the Responses proxy contract" >}} and {{< docs-link product="ai" source="docs/filters/openai_conversations.md" label="conversation handling" >}}. State storage and ownership are configuration decisions, not implied by using the endpoint.

{{< docs-link product="ai" source="docs/conformance/openresponses-translation.md" label="Translation conformance" >}} documents compatibility boundaries. Check tool support, event shapes, errors and state behavior for the specific path you deploy.

## Anthropic Messages

Use {{< docs-link product="ai" source="docs/anthropic-messages.md" label="the Anthropic Messages guide" >}} to choose a supported path. Native forwarding and translated requests have different contracts. Check the release's supported message blocks, tool behavior, streaming and provider prerequisites before pointing an application at the gateway.

## Backend routing and credentials

{{< docs-link product="ai" source="docs/filters/provider_route.md" label="Provider routing" >}} describes backend selection. {{< docs-link product="ai" source="docs/filters/credential_inject.md" label="Credential injection" >}} describes configured provider credentials; client authentication and authorization are separate concerns.

Use the source guide's exact configuration and build features. An API name alone does not guarantee that every model, endpoint or provider option is supported.

## Check the application path

1. Send a minimal request with the intended model and credentials.
2. Check the returned status and response shape against your client's expectations.
3. Exercise streaming, cancellation and tool calls if your application uses them.
4. Check provider errors and resource limits before exposing the gateway to other clients.

Continue with [gateway configuration]({{< relref "gateway/configure.md" >}}).
