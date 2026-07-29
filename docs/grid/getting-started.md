---
sidebar_position: 3
title: Getting Started
---

# Getting Started with Grid

Grid runs as a Kubernetes operator alongside the Praxis
AI gateway. This guide covers deploying the operator
and creating the CRDs that define your grid.

## Prerequisites

- Kubernetes 1.28+
- Praxis AI gateway deployed
- Rust 1.96+ (if building from source)

## Operator Deployment

The Grid operator runs three concurrent controllers
(GridNetwork, GridSite, InferenceProvider) and
optionally starts the SWIM runtime for multi-site
mesh networking.

### Environment Variables

| Variable | Description |
|---|---|
| `GRID_SWIM_BIND_ADDR` | Enables SWIM (e.g. `0.0.0.0:7946`) |
| `GRID_SWIM_ADVERTISE_ADDR` | Routable address for peers |
| `GRID_SWIM_SEEDS` | Comma-separated seed addresses |
| `GRID_SWIM_SITE_NAME` | Stable site identity |
| `GRID_SWIM_ENCRYPT_KEY` | 64-char hex string for AES-256-GCM |
| `GRID_GATEWAY_ADDRESS` | Data-plane gateway address |
| `GRID_SWIM_DEAD_MEMBER_TTL_SECS` | Dead member retention (default 300) |

SWIM activates only when `GRID_SWIM_BIND_ADDR` is set.
Without it, the operator manages CRDs in a single
cluster without mesh networking.

## Define a GridNetwork

A GridNetwork is the top-level tenancy boundary. One
cluster can host multiple networks.

```yaml
apiVersion: grid.praxis-proxy.io/v1alpha1
kind: GridNetwork
metadata:
  name: production
spec:
  seeds:
    - "site-east.example.com:7946"
    - "site-west.example.com:7946"
  region: us-east-1
  zone: us-east-1a
  gatewayRefs:
    - name: praxis-gateway
      namespace: praxis-system
      localSiteName: site-east
  swim:
    gossipNodes: 3
    probeInterval: "5s"
    suspicionTimeout: "10s"
  tls:
    caSecretRef:
      name: grid-ca
      namespace: grid-system
    siteSecretRef:
      name: grid-site-cert
      namespace: grid-system
    swimKeyRef:
      name: grid-swim-key
      namespace: grid-system
```

## Register a GridSite

GridSites represent remote clusters. They can be
created manually or auto-discovered via SWIM.

```yaml
apiVersion: grid.praxis-proxy.io/v1alpha1
kind: GridSite
metadata:
  name: site-west
spec:
  gridNetworkRef: production
  egress:
    address: "site-west.example.com:443"
    tls:
      mode: Mutual
  region: us-west-2
  zone: us-west-2a
  trust:
    certFingerprint: "sha256:abc123..."
```

The site progresses through phases: `Pending` ->
`Discovered` -> `Connecting` -> `Active`. It becomes
Active only after the cert fingerprint matches.

## Declare an InferenceProvider

InferenceProviders declare model capacity available to
the grid.

```yaml
apiVersion: grid.praxis-proxy.io/v1alpha1
kind: GridNetwork
metadata:
  name: production
---
apiVersion: grid.praxis-proxy.io/v1alpha1
kind: InferenceProvider
metadata:
  name: local-llama
spec:
  gridNetworkRef: production
  backendKind: local
  providerKind: self_hosted
  endpoint: "http://llama-service:8080"
  models:
    - name: llama-3.1-70b
      capabilities:
        - chat
        - completion
      contextWindow: 131072
  healthCheck:
    path: /health
    intervalSeconds: 30
  accessPolicy:
    siteSelector:
      matchLabels: {}
  metricsConfig:
    scrapeUrl: "http://llama-service:9090/metrics"
    scrapeIntervalSeconds: 15
```

### Cloud Provider Example

```yaml
apiVersion: grid.praxis-proxy.io/v1alpha1
kind: InferenceProvider
metadata:
  name: anthropic-api
spec:
  gridNetworkRef: production
  backendKind: api_provider
  providerKind: anthropic
  endpoint: "https://api.anthropic.com"
  models:
    - name: claude-sonnet-4-20250514
      capabilities:
        - chat
  auth:
    strategy: ApiKey
    secretRef:
      name: anthropic-api-key
      namespace: grid-system
  cost:
    perMillionInputTokens: 3.0
    perMillionOutputTokens: 15.0
  accessPolicy:
    siteSelector:
      matchLabels: {}
```

## How Routing Works

Once the operator reconciles these resources, it:

1. Lists local InferenceProviders
2. Scrapes their Prometheus metrics
3. Folds in remote provider records via CRDTs
4. Scores all candidates using six weighted signals
5. Filters by access policy
6. Writes `grid-config.json` to a ConfigMap

Praxis reads this ConfigMap through its `grid_route`
filter and selects the best candidate for each request.
Credentials are injected separately from mounted
secrets - token bytes never appear in the ConfigMap.

## Consumer Config Generation

For automated Praxis configuration, enable
`consumerConfig` on a gateway reference:

```yaml
gatewayRefs:
  - name: praxis-gateway
    namespace: praxis-system
    localSiteName: site-east
    consumerConfig:
      enabled: true
      credentialMountBase: /run/secrets/grid-credentials
      configMapName: praxis-consumer-config
      listenerPort: 8080
      clusterEndpoints:
        - cluster: local-llama
          address: "llama-service:8080"
          transport:
            mode: Plaintext
```

The operator renders a complete Praxis config with
listeners, filter chains (`grid_route`,
`grid_credential_inject`, `load_balancer`), and an
admin listener. Transport mode is required on every
cluster endpoint (fail-closed).

## Next Steps

- [Concepts](concepts) - Deep dive into CRDs, SWIM,
  CRDTs, and scoring
- [Grid Booklet](/praxis-grid-booklet.html) -
  Interactive visual guide with live diagrams
