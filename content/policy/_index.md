+++
title = "Praxis Policy Engine"
description = "A policy runtime for authorization, identity, delegation, and data controls."
type = "landing"
layout = "list"
product = "policy"
body_class = "product-overview-page"
+++

The Praxis Policy Engine (PPE) is a Rust library for authorization, identity, delegation, and data controls. Add it to a host application or gateway where policy enforcement belongs; the selected release does not provide a standalone proxy service. Its v0.4.0 quickstart builds a `get_employee` policy scenario that authorizes by role and redacts fields by permission. It requires the Rust 1.96.0 toolchain pinned by the repository and a Rust host application.

{{< docs-link product="policy" source="docs/content/quickstart.md" label="Follow the Policy Engine quickstart" >}}. The v0.4.x line is covered by the [Policy security policy](https://github.com/praxis-proxy/policy/blob/v0.4.0/SECURITY.md), while the public API is still evolving.

Version numbers do not establish compatibility with the proxy. Praxis v0.7.2 pins its PPE dependency to v0.3.1; the independently selected Policy documentation release is v0.4.0. This site has not verified those releases as an integrated pair.

{{< product-landing product="policy" >}}
