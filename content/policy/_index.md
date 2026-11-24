+++
title = "Praxis Policy Engine"
description = "A policy runtime for authorization, identity, delegation, and data controls."
type = "landing"
layout = "list"
product = "policy"
body_class = "product-overview-page"
+++

{{< release-checked product="policy" release="v0.7.0" >}}

The Praxis Policy Engine (PPE) is a Rust library for authorization, identity, delegation, and data controls. Add it to a host application or gateway where policy enforcement belongs; the selected release does not provide a standalone proxy service. Its {{< product-release product="policy" />}} quickstart builds a `get_employee` policy scenario that authorizes by role and redacts fields by permission. It requires the Rust 1.96.0 toolchain pinned by the repository and a Rust host application.

{{< docs-link product="policy" source="docs/content/quickstart.md" label="Follow the Policy Engine quickstart" >}}. Policy is pre-v1 alpha software whose public API is still evolving; its [security policy]({{< product-release product="policy" path="SECURITY.md" />}}) explains how to report a vulnerability.

Version numbers do not establish compatibility with the proxy. Praxis {{< product-release product="praxis" />}} pins its PPE dependency independently of the Policy documentation release, {{< product-release product="policy" />}}; the [Praxis capability matrix]({{< relref "../praxis/capabilities.md" >}}) names the pinned version. This site has not verified those releases as an integrated pair.

{{< product-landing product="policy" >}}
