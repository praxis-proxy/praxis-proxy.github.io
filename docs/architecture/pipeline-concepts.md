---
title: Pipeline Concepts
sidebar_position: 4
---

# Pipeline Concepts

Core ideas behind Praxis filter pipelines: how filters
compose, how results flow into branch chains, and how
names are resolved.

## Filter Results

Filters can write structured key-value pairs to a
`FilterResultSet` during request processing. Branch
conditions read these results to decide whether to
divert, short-circuit, skip ahead, or loop back.

- Results are keyed by the filter **type name** (from
  `HttpFilter::name()`), not the user-assigned `name:`
  on the filter entry.
- Results are cleared after branch evaluation completes.
- Built-in writers include `guardrails`, `json_rpc`,
  `grpc_detection`, and AI classifiers (`mcp`, `a2a`,
  `openai_responses_format`, and others).

See [Branch Chains](/docs/filters/branch-chains) for
condition syntax and examples.

## The Two Meanings of "Name"

Praxis uses `name` in two different places:

1. **Filter entry `name:`** — optional label on a
   filter chain entry. Used for logging, skip-to targets,
   and reentrance loops. This is user-assigned.
2. **Filter type name** — the string returned by
   `HttpFilter::name()` (e.g. `"guardrails"`). Branch
   `on_result.filter` and result keys always use the type
   name.

When configuring `on_result.filter`, use the type name,
not the entry label.

## Related

- [Filter model](/docs/filters/filter-model)
- [Branch chains](/docs/filters/branch-chains)
- [Life of a request](/docs/architecture/life-of-a-request)
