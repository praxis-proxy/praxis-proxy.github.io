+++
title = "Praxis AI"
description = "An alpha AI gateway with provider-aware routing and filters, built on the Praxis proxy runtime."
type = "landing"
layout = "list"
product = "ai"
body_class = "product-overview-page"
+++

Praxis AI adds AI request classification, provider routing, translation, and agent-protocol features to the Praxis proxy runtime. Its releases are independent of the core proxy. The selected v0.7.0 release is alpha; APIs and configuration may change before v1.0.0. Review its [release-matched security policy](https://github.com/praxis-proxy/ai/blob/v0.7.0/.github/SECURITY.md) before deployment.

Start with the [container quickstart]({{< relref "container-quickstart.md" >}}) to route a request to OpenAI. It requires an `OPENAI_API_KEY`, a provider account, and network access to `api.openai.com:443`. For source builds and development, {{< docs-link product="ai" source="docs/quickstart.md" label="see the source quickstart" >}}. For capabilities and setup-dependent features, {{< docs-link product="ai" source="docs/features.md" label="read the release feature overview" >}}.

The AI v0.7.0 and Praxis v0.7.2 release numbers are independent; this site has not verified them as a compatibility set. Choose versions from the relevant project manifests and test the combination you deploy.

{{< product-landing product="ai" >}}
