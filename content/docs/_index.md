+++
title = "Documentation"
description = "Choose your task, get a first result, and configure your deployment."
type = "landing"
layout = "list"
body_class = "docs-page"
+++

<header class="docs-hub-header">
  <p class="home-eyebrow">Praxis documentation</p>
  <h1>What do you want to build?</h1>
  <p>Start with the task you need to complete. Each project has its own setup, release history, and configuration reference.</p>
</header>

<div id="tutorials">
<span id="how-to-guides"></span>

{{< task-chooser prerequisites="true" compact="true" >}}

</div>

<section class="docs-hub-returning">
  <h2>Already running Praxis?</h2>
  <p>Continue with a configuration task, operate your proxy, or look up an exact setting.</p>
  <nav class="project-task-paths" aria-label="Operator tasks">
    <a href="{{< relref "guides/use-filters.md" >}}">Configure filters</a>
    <a href="{{< relref "guides/operate/_index.md" >}}">Operate your proxy</a>
    <a href="{{< relref "examples/_index.md" >}}">Find an example</a>
    <a href="{{< relref "search/_index.md" >}}">Search documentation</a>
  </nav>
</section>

<section id="reference" class="docs-hub-returning">
  <h2>Find exact options</h2>
  <ul>
    <li>{{< docs-link product="praxis" source="docs/filters/reference.md" label="Praxis filter configuration" >}}</li>
    <li>{{< docs-link product="ai" source="docs/filters/reference.md" label="Praxis AI filter configuration" >}}</li>
    <li>{{< docs-link product="policy" source="docs/content/configuration.md" label="Policy Engine configuration" >}}</li>
    <li>{{< docs-link product="grid" source="docs/architecture/crds.md" label="Grid resource definitions" >}}</li>
  </ul>
</section>

<section id="explanation" class="docs-hub-returning">
  <h2>Understand the projects</h2>
  <p>Read the release-specific architecture before designing an integration.</p>
  <ul>
    <li>{{< docs-link product="praxis" source="docs/architecture/overview.md" label="Praxis architecture" >}}</li>
    <li>{{< docs-link product="ai" source="docs/architecture/ai-inference.md" label="AI inference architecture" >}}</li>
    <li>{{< docs-link product="policy" source="docs/content/overview.md" label="Policy enforcement pipeline" >}}</li>
    <li>{{< docs-link product="grid" source="docs/architecture/overview.md" label="Grid architecture" >}}</li>
  </ul>
</section>

<section class="docs-hub-returning">
  <h2>Extend or contribute</h2>
  <p>Build custom behavior in Rust or work on the projects themselves. Follow the <a href="{{< relref "guides/extend/_index.md" >}}">developer path</a> for extension interfaces and contributor setup.</p>
</section>

<p class="docs-release-note">The starting paths use each project’s default documentation release. Choose archived or unreleased Development documentation from that project’s version selector. Project version numbers do not establish a tested compatibility set.</p>
