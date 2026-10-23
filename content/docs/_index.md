+++
title = "Documentation"
description = "Browse Praxis documentation by project and reader need."
type = "landing"
layout = "list"
body_class = "docs-page"
+++

<header>
  <h1>Find what you need</h1>
  <p>Install or run Praxis, configure it, or look up an exact setting. Start with a task, then browse the release-matched guides and references.</p>
</header>

<nav class="project-task-paths" aria-label="Operator tasks">
  <a href="{{< relref "guides/install.md" >}}">Install Praxis</a>
  <a href="{{< relref "guides/first-proxy.md" >}}">Run your first proxy</a>
  <a href="{{< relref "guides/use-filters.md" >}}">Configure filters</a>
  <a href="{{< relref "guides/operate/_index.md" >}}">Operate Praxis</a>
  <a href="{{< relref "examples/_index.md" >}}">Find an example</a>
</nav>

<p><strong>Developer path:</strong> <a href="{{< relref "guides/extend/_index.md" >}}">Extend Praxis with Rust</a></p>

{{< docs-reader-needs >}}

<p>Default documentation routes change when a project promotes a release. Archived and development documentation remain available from each project’s version selector.</p>
