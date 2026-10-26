+++
title = "Extend and contribute"
description = "Use Rust when you need custom filters, protocols, or changes to the Praxis project."
type = "guides"
weight = 50
body_class = "guides-page"
+++

Running Praxis and configuring its built-in behavior do not require Rust. This path is for developers who need behavior that the selected binary does not provide, want to write an extension, or plan to contribute to a project.

## Tutorial: write a filter

Follow {{< docs-link product="praxis" source="docs/filters/http-filter-tutorial.md" label="the custom HTTP filter tutorial" >}} to implement behavior in Rust and build a proxy with that filter.

## How-to: add behavior and contribute

{{< docs-link product="praxis" source="docs/developing/adding-filters.md" label="Add a built-in filter" >}} or {{< docs-link product="praxis" source="docs/developing/adding-protocols.md" label="add a protocol" >}} to Praxis itself. To contribute a change, use {{< docs-link product="praxis" source="docs/developing/getting-started.md" label="the development setup and test commands" >}}, then read {{< docs-link product="praxis" source="docs/developing/conventions.md" label="contribution conventions" >}} and {{< docs-link product="praxis" source="docs/developing/dependencies.md" label="dependency guidance" >}}. Project proposals are tracked in the [enhancements repository](https://github.com/praxis-proxy/enhancements).

## Reference: extension interfaces

{{< docs-link product="praxis" source="docs/filters/extensions.md" label="The filter extension reference" >}} describes extension interfaces and registration. Pair it with {{< docs-link product="praxis" source="docs/filters/reference.md" label="the built-in filter reference" >}} for the types and configuration available in the selected release.

## Explanation: runtime and crate design

{{< docs-link product="praxis" source="docs/architecture/pipeline-concepts.md" label="Pipeline concepts" >}} explains how configured chains form a request pipeline; {{< docs-link product="praxis" source="docs/architecture/crate-layout.md" label="the crate layout" >}} describes where runtime and extension interfaces live.

For AI-specific filters, build and develop in the independently versioned Praxis AI project: {{< docs-link product="ai" source="docs/developing/getting-started.md" label="AI development setup" >}} and {{< docs-link product="ai" source="docs/developing/adding-filters.md" label="adding an AI filter" >}}.

See the [operator path]({{< relref "../operate/_index.md" >}}) for configuration tasks that do not need custom Rust code.
