import {themes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'Praxis',
  tagline: 'The proxy built for AI infrastructure',
  favicon: 'img/favicon.ico',

  future: {
    v4: true,
  },

  url: 'https://praxis.fast',
  baseUrl: '/',
  organizationName: 'praxis-proxy',
  projectName: 'praxis-proxy.github.io',
  onBrokenLinks: 'throw',

  markdown: {
    mermaid: true,
    hooks: {
      onBrokenMarkdownLinks: 'throw',
    },
  },

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  headTags: [
    {
      tagName: 'link',
      attributes: {
        rel: 'preconnect',
        href: 'https://fonts.googleapis.com',
      },
    },
    {
      tagName: 'link',
      attributes: {
        rel: 'preconnect',
        href: 'https://fonts.gstatic.com',
        crossorigin: 'anonymous',
      },
    },
    {
      tagName: 'link',
      attributes: {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&family=Hanken+Grotesk:wght@300;400;500;600;700&display=swap',
      },
    },
  ],

  presets: [
    [
      'classic',
      {
        docs: {
          path: './docs',
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/praxis-proxy/praxis-proxy.github.io/tree/main/',
        },
        blog: {
          showReadingTime: true,
          onInlineAuthors: 'ignore',
          editUrl: 'https://github.com/praxis-proxy/praxis-proxy.github.io/tree/main/',
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themes: [
    '@docusaurus/theme-mermaid',
    [
      '@easyops-cn/docusaurus-search-local',
      {
        hashed: true,
        indexBlog: true,
        indexDocs: true,
        docsDir: './docs',
        docsRouteBasePath: '/docs',
        highlightSearchTermsOnTargetPage: true,
      },
    ],
  ],

  themeConfig: {
    colorMode: {
      defaultMode: 'dark',
      disableSwitch: false,
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'Praxis',
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docs',
          position: 'left',
          label: 'Docs',
        },
        {to: '/docs/grid/overview', label: 'Grid', position: 'left'},
        {to: '/examples', label: 'Examples', position: 'left'},
        {
          type: 'dropdown',
          label: 'Visual Guides',
          position: 'left',
          items: [
            {label: 'Praxis Core', href: 'pathname:///praxis-core-booklet.html'},
            {label: 'Praxis AI', href: 'pathname:///praxis-ai-booklet.html'},
            {label: 'Praxis Grid', href: 'pathname:///praxis-grid-booklet.html'},
          ],
        },
        {to: '/blog', label: 'Blog', position: 'left'},
        {
          href: 'https://github.com/praxis-proxy/praxis',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      logo: {
        alt: 'CNCF Logo',
        src: 'img/cncf-color.svg',
        srcDark: 'img/cncf-white.png',
        href: 'https://cncf.io',
        target: '_blank',
        width: 240,
        className: 'footer-logo',
        style: {
          marginRight: '10px',
        },
      },
      links: [
        {
          title: 'Documentation',
          items: [
            {
              html: '<a href="/docs/getting-started/introduction" class="footer__link-item">Getting Started</a>',
            },
            {
              html: '<a href="/docs/architecture/system-design" class="footer__link-item">Architecture</a>',
            },
            {
              html: '<a href="/docs/grid/overview" class="footer__link-item">Grid</a>',
            },
          ],
        },
        {
          title: 'Community',
          items: [
            {
              html: '<a href="https://github.com/praxis-proxy/praxis/discussions" class="footer__link-item" target="_blank" rel="noreferrer noopener">Contact us</a>',
            },
            {
              html: '<a href="/docs/development/contributing" class="footer__link-item">Contributing</a>',
            },
            {
              html: '<a href="https://github.com/cncf/foundation/blob/main/code-of-conduct.md" class="footer__link-item" target="_blank" rel="noreferrer noopener">Code of Conduct</a>',
            },
          ],
        },
        {
          title: 'More',
          items: [
            {
              html: '<a href="/blog" class="footer__link-item">Blog</a>',
            },
            {
              label: 'Privacy Policy',
              href: 'https://www.linuxfoundation.org/privacy',
            },
          ],
        },
        {
          title: 'Social',
          items: [
            {
              html: `
                <div class="footer-socials" role="navigation" aria-label="Social links">
                  <div class="footer-socials-row">
                    <a href="https://github.com/praxis-proxy/praxis" target="_blank" rel="noreferrer noopener" aria-label="GitHub">
                      <img src="/img/social/github-mark-white.png" alt="GitHub" />
                    </a>
                    <a href="https://cloud-native.slack.com/archives/C0BK0RSP5RC" target="_blank" rel="noreferrer noopener" aria-label="Slack">
                      <img src="/img/social/slack-mark-white.png" alt="Slack" />
                    </a>
                    <a href="https://x.com/_praxis_ai" target="_blank" rel="noreferrer noopener" aria-label="X">
                      <img src="/img/social/x-mark-white.png" alt="X" />
                    </a>
                    <a href="https://www.linkedin.com/company/praxis-proxy/" target="_blank" rel="noreferrer noopener" aria-label="LinkedIn">
                      <img src="/img/social/linkedin-mark-white.png" alt="LinkedIn" />
                    </a>
                    <a href="https://bsky.app/profile/praxis.fast" target="_blank" rel="noreferrer noopener" aria-label="Bluesky">
                      <img src="/img/social/bluesky-mark.svg" alt="Bluesky" />
                    </a>
                  </div>
                  <div class="footer-cncf">
                    <img class="footer-cncf-logo" src="/img/CNCF-logo.svg" alt="CNCF" />
                    <span>Praxis is a CNCF Sandbox project</span>
                  </div>
                  <div class="footer-socials-cta">
                    <a href="https://slack.cncf.io" target="_blank" rel="noreferrer noopener" aria-label="Join our Slack">
                      <span class="button-link">Join our Slack</span>
                    </a>
                  </div>
                </div>
              `,
            },
          ],
        },
      ],
      copyright: `Copyright Praxis a Series of LF Projects, LLC. Apache 2.0 License.<br />\
        We are a Cloud Native Computing Foundation sandbox project.<br />\
        For website terms of use, trademark policy and other project policies please see <a href="https://lfprojects.org/policies/" target="_blank" rel="noreferrer noopener">https://lfprojects.org/policies/</a>`,
    },
    prism: {
      theme: themes.vsLight,
      darkTheme: themes.vsDark,
      additionalLanguages: ['bash', 'yaml', 'toml', 'rust', 'json'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
