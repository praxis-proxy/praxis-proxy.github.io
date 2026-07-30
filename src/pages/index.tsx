import React from 'react';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import styles from './index.module.css';

const features = [
  {
    title: 'Route to Any AI Provider',
    description:
      'Send requests to OpenAI, Anthropic, or your own models. Praxis reads the model name, injects the right API key, and routes to the right upstream — your app never touches a credential.',
    icon: '⇉',
  },
  {
    title: 'Built for Claude Code & Codex',
    description:
      'Native MCP gateway — aggregate tools from multiple servers behind one endpoint. Praxis handles session management, credential injection, and tool-call routing so your AI coding agents work securely at scale.',
    icon: '◈',
  },
  {
    title: 'Build Pipelines, Not Middleware',
    description:
      'Stack rate limiting, auth, guardrails, and routing in any order using a simple YAML config. 50+ built-in filters ship ready to use, and you can write your own in Rust.',
    icon: '≡',
  },
  {
    title: 'Security Without the Setup',
    description:
      'TLS everywhere, zero unsafe code, CORS and rate limiting out of the box. Praxis ships locked down so you don\'t have to bolt security on after the fact.',
    icon: '△',
  },
  {
    title: 'Ship Changes Without Downtime',
    description:
      'HTTP/1.1, HTTP/2, gRPC, WebSocket, TCP — all supported. Hot-reload your config at runtime without dropping a single connection.',
    icon: '⬡',
  },
];

const guides = [
  {
    title: 'Praxis Core',
    description:
      'How requests flow through filter pipelines, how chains compose, and how config reloads without dropping a connection.',
    href: 'pathname:///praxis-core-booklet.html',
    label: 'Read the Core guide',
  },
  {
    title: 'Praxis AI',
    description:
      'How the AI gateway classifies requests, routes to providers, injects credentials, and speaks MCP and A2A.',
    href: 'pathname:///praxis-ai-booklet.html',
    label: 'Read the AI guide',
  },
  {
    title: 'Praxis Grid',
    description:
      'How the distributed control plane converges state with CRDTs, discovers sites with SWIM, and scores routes by locality.',
    href: 'pathname:///praxis-grid-booklet.html',
    label: 'Read the Grid guide',
  },
];

function Pipeline() {
  return (
    <div className={styles.pipeline} aria-hidden="true">
      <div className={styles.pipelineLabel}>Filter Pipeline</div>

      <div className={styles.pipelineEntry}>
        <div className={styles.pipelineDot} />
        <span className={styles.pipelineEntryLabel}>incoming request</span>
      </div>

      <div className={styles.pipelineConnector}>
        <div className={styles.flowDot} style={{ animationDelay: '0s' }} />
      </div>

      <div className={styles.filterNode}>
        <div className={styles.filterName}>cors</div>
        <div className={styles.filterDesc}>origin validation</div>
      </div>

      <div className={styles.pipelineConnector}>
        <div className={styles.flowDot} style={{ animationDelay: '0.3s' }} />
      </div>

      <div className={styles.filterNode}>
        <div className={styles.filterName}>rate_limit</div>
        <div className={styles.filterDesc}>token bucket · per_ip</div>
      </div>

      <div className={styles.pipelineConnector}>
        <div className={styles.flowDot} style={{ animationDelay: '0.6s' }} />
      </div>

      <div className={styles.filterNode}>
        <div className={styles.filterName}>model_to_header</div>
        <div className={styles.filterDesc}>extract model → X-Model</div>
      </div>

      <div className={styles.pipelineConnector}>
        <div className={styles.flowDot} style={{ animationDelay: '0.9s' }} />
      </div>

      <div className={styles.filterNode + ' ' + styles.filterNodeAccent}>
        <div className={styles.filterName}>router</div>
        <div className={styles.filterDesc}>match X-Model header</div>
      </div>

      <div className={styles.pipelineBranch}>
        <div className={styles.branchLeft}>
          <div className={styles.branchConnector}>
            <div className={styles.flowDot} style={{ animationDelay: '1.2s' }} />
          </div>
          <div className={styles.filterNodeSmall}>
            <div className={styles.filterName}>openai</div>
            <div className={styles.filterDesc}>credential_injection</div>
          </div>
        </div>
        <div className={styles.branchRight}>
          <div className={styles.branchConnector}>
            <div className={styles.flowDot} style={{ animationDelay: '1.4s' }} />
          </div>
          <div className={styles.filterNodeSmall}>
            <div className={styles.filterName}>anthropic</div>
            <div className={styles.filterDesc}>credential_injection</div>
          </div>
        </div>
      </div>

      <div className={styles.pipelineFooter}>
        <div className={styles.pipelineConnectorCenter}>
          <div className={styles.flowDot} style={{ animationDelay: '1.7s' }} />
        </div>
        <div className={styles.filterNodeSmall}>
          <div className={styles.filterName}>load_balancer</div>
          <div className={styles.filterDesc}>→ upstream</div>
        </div>
      </div>
    </div>
  );
}


export default function Home(): React.JSX.Element {
  return (
    <Layout description="High-performance, security-first HTTP proxy and framework for AI and cloud-native workloads.">
      <main>
        <section className={styles.hero}>
          <div className={styles.heroGlow} aria-hidden="true" />
          <div className={styles.heroOrbit} aria-hidden="true" />
          <div className={styles.heroSplit}>
            <div className={styles.heroContent}>
              <h1 className={styles.heroTitle}>
                The proxy built for<br />
                <span className={styles.heroAccent}>AI infrastructure</span>
              </h1>

              <p className={styles.heroSubtitle}>
                One proxy between your apps and every AI provider. Route traffic,
                manage keys, enforce guardrails — all from a single config file.
                Built in Rust for performance and safety.
              </p>

              <div className={styles.heroCtas}>
                <a className={styles.ctaPrimary} href="/docs/getting-started/introduction">
                  Get Started
                </a>
                <a
                  className={styles.ctaSecondary}
                  href="https://github.com/praxis-proxy/praxis"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  GitHub
                </a>
              </div>

            </div>

            <div className={styles.heroVisual}>
              <Pipeline />
            </div>
          </div>

          <div className={styles.heroLine} aria-hidden="true" />
        </section>

        <section className={styles.features}>
          <div className={styles.featuresInner}>
            <h2 className={styles.featuresTitle}>Why teams choose Praxis</h2>
            <div className={styles.featuresGrid}>
              {features.map((feature) => (
                <div key={feature.title} className={styles.featureCard}>
                  <h3 className={styles.featureTitle}>
                    <span className={styles.featureIcon} aria-hidden="true">{feature.icon}</span>
                    {feature.title}
                  </h3>
                  <p className={styles.featureDesc}>{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.guides}>
          <div className={styles.guidesInner}>
            <h2 className={styles.guidesTitle}>Understand the architecture</h2>
            <p className={styles.guidesSubtitle}>
              Interactive visual guides that walk through how Praxis works
              with animated diagrams.
            </p>
            <div className={styles.guidesGrid}>
              {guides.map((guide) => (
                <Link
                  key={guide.title}
                  className={styles.guideCard}
                  href={guide.href}
                >
                  <h3 className={styles.guideCardTitle}>{guide.title}</h3>
                  <p className={styles.guideCardDesc}>{guide.description}</p>
                  <span className={styles.guideCardLink}>
                    {guide.label} &rarr;
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.ctaSection}>
          <div className={styles.ctaInner}>
            <div>
              <h2 className={styles.ctaSectionTitle}>Deploy in minutes, not weeks.</h2>
              <p className={styles.ctaSectionSub}>
                MIT licensed. One binary, one config file, production-ready.
              </p>
            </div>
            <div className={styles.ctaLinks}>
              <a className={styles.ctaPrimary} href="/docs/getting-started/quickstart">
                Quick Start
              </a>
              <a className={styles.ctaSecondary} href="/examples">
                Examples
              </a>
              <a
                className={styles.ctaSecondary}
                href="https://github.com/praxis-proxy/praxis"
                target="_blank"
                rel="noopener noreferrer"
              >
                GitHub
              </a>
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}
