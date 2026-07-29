---
sidebar_position: 2
title: Concepts
---

# Grid Concepts

Grid uses Kubernetes Custom Resource Definitions to
describe the world, SWIM for membership discovery, and
CRDTs for state convergence. This page covers each.

## Custom Resources

All CRDs are cluster-scoped in the
`grid.praxis-proxy.io/v1alpha1` API group.

### GridNetwork

The top-level tenancy boundary. A cluster can host
multiple GridNetworks for multi-tenancy.

| Field | Description |
|---|---|
| `gridId` | Auto-generated on first join |
| `seeds` | SWIM seed peer addresses (`host:port`) |
| `gatewayRefs` | References to participating Praxis gateways |
| `region` / `zone` | Deployment geography |
| `swim` | Protocol tuning: `gossipNodes` (default 3), `probeInterval` (default `5s`), `suspicionTimeout` (default `10s`) |
| `tls` | Secret references for CA, site certs, and SWIM encryption key |
| `staleCandidateTtlSeconds` | Max age before stale remote candidates are evicted |

Each gateway reference can optionally enable
`consumerConfig` to have Grid render a complete Praxis
configuration (listeners, filter chains with
`grid_route` and `grid_credential_inject`, admin
listener).

**Phases:** `Pending` -> `Initializing` -> `Active` ->
`Degraded`

### GridSite

Represents a participating cluster in the grid.
Created manually or auto-discovered via SWIM.

| Field | Description |
|---|---|
| `gridNetworkRef` | Parent GridNetwork name |
| `egress` | Egress endpoint (address + TLS mode) |
| `region` / `zone` / `sovereigntyZone` | Site geography |
| `trust` | `certFingerprint` (SHA-256) for mTLS pinning |

A site becomes `Active` only after its cert fingerprint
matches the configured trust value.

**Phases:** `Pending` -> `Discovered` -> `Connecting`
-> `Active` -> `Unreachable` -> `Left`

**Phase transitions:**

- Pending -> Discovered: SWIM peer observed as alive
  (requires auto-discover label)
- Discovered -> Connecting: egress address available
- Connecting -> Active: TCP probe passes AND cert
  fingerprint matches
- Active -> Unreachable: TCP probe failure

### InferenceProvider

Declares inference backend capacity available to the
grid.

| Field | Description |
|---|---|
| `gridNetworkRef` | Parent GridNetwork name |
| `backendKind` | `local`, `remote`, `cloud_managed`, or `api_provider` |
| `providerKind` | `open_ai`, `anthropic`, `bedrock`, `vertex`, or `self_hosted` |
| `models` | List of model names, capabilities, and context windows |
| `endpoint` | Backend endpoint URL |
| `cost` | Per-million input/output token costs |
| `healthCheck` | Health check configuration |
| `auth` | Strategy (`ApiKey`, `BearerToken`, `MtlsOnly`, `Oauth2`, `ServiceAccount`, `Sigv4`, `Custom`) + secret reference |
| `accessPolicy` | Site label selector controlling which sites can consume this provider |
| `metricsConfig` | Prometheus scrape config with signal name mapping |

**Phases:** `Pending` -> `Available` -> `Degraded` ->
`Unavailable`

### The Output

Not a CRD - the rendered `grid-config.json` ConfigMap
that Praxis AI's `grid_route` filter consumes.
Contains pre-sorted candidates with scores, admission
state, locality tier, and credential references.

Credentials never appear in ConfigMaps, logs, status
fields, or tracing spans. Grid projects a reference to
a Kubernetes Secret, and the token is injected later by
Praxis from a mounted secret.

## SWIM Membership

Grid learns which sites are alive using
[SWIM](https://www.cs.cornell.edu/projects/Quicksilver/public_pdfs/SWIM.pdf),
a gossip-based membership protocol. Grid wraps the
[foca](https://crates.io/crates/foca) crate and
carries it over AES-256-GCM encrypted UDP (default
port 7946).

There is no central registry. Each site periodically
probes a random peer. If it goes quiet, others
double-check before anyone is declared gone. News of a
join or failure spreads like an infection - reaching
the whole mesh in `O(log n)` rounds.

**Wire encryption:** 4-byte `GRID` magic, 1-byte
version, 12-byte nonce (OS RNG), ciphertext, 16-byte
GCM tag - 33 bytes of overhead total. Wrong key or
tampered data causes silent packet drop.

SWIM membership events feed the operator controllers,
which re-render the overlay. CRDT state broadcasts
piggyback on SWIM probe messages - no separate
transport needed.

## CRDTs

A CRDT (Conflict-free Replicated Data Type) merges
automatically and always converges with no coordinator.
Its merge operation is commutative, associative, and
idempotent - messages can arrive out of order,
duplicated, or batched, and every site still lands on
identical final state (**strong eventual consistency**).

Grid uses three CRDT types:

### LWW Registers

Last-writer-wins registers for provider records.
Each write carries a `(revision, writer_id)` tuple.
Higher revision wins; equal revisions break ties by
lexicographic `writer_id`. The rule is deterministic,
so every site chooses the same winner.

Used for: provider metrics (queue depth, latency,
KV-cache utilization, health state).

### OR-Sets

Add-wins Observed-Remove Sets for capabilities
(models, tools, agents). Each add creates a unique
tag; a remove only tombstones tags it has observed.
If one site adds a model while another removes it,
the add's fresh tag survives the stale tombstone list.

Used for: model, tool, and agent capability sets.

### G-Counters

Grow-only counters with per-site slots. Each site
increments only its own slot; the real value is the
sum. Merge takes the max of each slot.

Used for: per-tenant budget tracking. Under network
partition, each site sees a lower bound rather than
hard-rejecting requests.

### State Exchange

The unit of exchange between sites is a
`GridStateSnapshot` carrying provider capabilities,
lifecycle phase, and normalized scoring metrics.
Snapshots piggyback on SWIM probe messages across four
independent invalidation lanes (state, gateway, cert,
metadata) so a gateway address update cannot block a
provider state broadcast.

## Scoring

The scoring engine blends six normalized signals with
configurable weights:

| Signal | Weight | Description |
|---|---|---|
| Locality | 3.0 | Local=1.0, remote same-region=0.7, cross-region=0.4, cloud=0.2, API=0.1 |
| Queue depth | 3.0 | Lower queue = higher score |
| KV-cache utilization | 2.0 | More available cache = higher score |
| Prefix-cache hit ratio | 2.0 | Warmer cache = higher score |
| P99 latency | 2.0 | Lower latency = higher score |
| Cost per token | 1.0 | Cheaper = higher score |

Missing values default to a neutral `0.5`. Unhealthy
providers are excluded entirely.

Post-scoring, candidates are enriched with:

- **Admission state** - `NewAndExisting`,
  `ExistingOnly`, or `Excluded` based on metric
  thresholds
- **Locality tier** - `SameSite`, `SameZone`,
  `SameRegion`, or `CrossRegion`

The final sort order: admission state first, then
locality tier, then score, then freshness. Praxis
picks from the top.

### Backend Kind Preference

The locality signal encodes a clear preference ladder
by `backendKind`:

1. **local** - Self-hosted, local site (score 1.0)
2. **remote** - Self-hosted, another Grid site (0.7
   same-region, 0.4 cross-region)
3. **cloud_managed** - Managed cloud capacity (0.2)
4. **api_provider** - Third-party API fallback (0.1)

Use capacity you own and that is near before falling
out to third-party APIs.

## Security

- **SWIM encryption** - AES-256-GCM on all UDP traffic
  with a shared symmetric key
- **Site trust** - mTLS with SHA-256 cert fingerprint
  pinning; a GridSite becomes Active only after
  fingerprint verification passes
- **Credential isolation** - Token bytes never appear
  in ConfigMaps, logs, or status fields; Grid stores
  only Secret references
- **Cert propagation safety** - Public cert PEMs
  propagate via SWIM broadcasts with structural checks
  that discard any message containing private key
  markers

## Visual Guide

For interactive diagrams showing SWIM probing, CRDT
convergence, and the scoring pipeline, see the
[Grid Booklet](pathname:///praxis-grid-booklet.html).
