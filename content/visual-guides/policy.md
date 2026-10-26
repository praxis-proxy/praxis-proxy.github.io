+++
title = "Policy decisions and effects"
description = "How the independent Policy Engine uses identity and policy to control agent operations."
type = "guides"
weight = 30
+++

The Praxis Policy Engine (PPE) is an independent policy runtime. This guide answers why one operation can produce different results for different callers, then shows where identity and enforcement sit. It is optional to Praxis and Praxis AI deployments.

## Why can the same operation return different data?

PPE resolves the caller's identity, evaluates the policy for an operation, and applies the resulting effects at the enforcement boundary. The backend can return the same record for each caller while policy permits, redacts, or denies what reaches the caller.

{{< docs-asset product="policy" source="docs/images/overview_outcomes.svg" alt="Three callers make the same get_compensation request. Policy returns the complete record to an HR caller with permission, redacts the SSN for an HR caller without permission, and denies an engineer before the backend call." width="1200" height="560" caption="One operation, three policy outcomes." >}}

This existing SVG comes from the Policy v0.4.0 source at commit [`fb94b2b81e5909b72949323921625de7ba7ce328`](https://github.com/praxis-proxy/policy/blob/fb94b2b81e5909b72949323921625de7ba7ce328/docs/images/overview_outcomes.svg), licensed under Apache-2.0. Its text equivalent is the preceding explanation: allow, redact, and deny are different outcomes of the same request under different identities.

See {{< docs-link product="policy" source="docs/content/overview.md" label="How PPE works" >}} and {{< docs-link product="policy" source="docs/content/apl/effects.md" label="APL effects" >}}.

## Where are inbound identity and delegation boundaries?

PPE resolves and validates the caller's identity at the inbound boundary. When an operation calls another service, delegation can mint a narrower downstream credential at a separate outbound boundary. The engine's source docs cover {{< docs-link product="policy" source="docs/content/apl/identity.md" label="identity resolution" >}}, {{< docs-link product="policy" source="docs/content/apl/effects.md" label="policy effects" >}}, and {{< docs-link product="policy" source="docs/content/deployment.md" label="deployment placements" >}}.

{{< docs-asset product="policy" source="docs/images/identity_two_boundaries.svg" alt="At the inbound boundary, identity.resolve validates caller credentials and fills identity fields. At the outbound boundary, token.delegate mints a downstream credential scoped to the route's subject." width="1200" height="540" caption="Inbound identity resolution and outbound credential delegation." >}}

This existing SVG is from the same pinned [Policy v0.4.0 commit](https://github.com/praxis-proxy/policy/blob/fb94b2b81e5909b72949323921625de7ba7ce328/docs/images/identity_two_boundaries.svg). PPE defines policy; its enforcement point sits where the host can protect the operation and result.

The diagrams are source-authored PPE assets; no website redraw or change to their meaning was made. Policy v0.4.0 is an evolving public API, so follow its release-matched docs when configuring an integration.
