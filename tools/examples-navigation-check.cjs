/* Run against a built site with the existing isolated Playwright/Axe modules. */
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const base = process.env.QA_BASE_URL || 'http://127.0.0.1:18131';
const output = process.env.QA_OUTPUT || path.join(root, 'output/playwright/impeccable-examples');
const sources = JSON.parse(fs.readFileSync(path.join(root, '.cache/docs-data/docs_sources.json')));
const defaults = JSON.parse(fs.readFileSync(path.join(root, 'data/docs_versions.json'))).products;
const route = (product, version, source) => {
  const entry = sources.find(x => x.product === product && x.version === version && x.source_path === source);
  assert(entry, `Missing source mapping: ${product}/${version}/${source}`);
  return entry.url;
};
const pages = [
  ['examples-hub', '/examples/', null],
  ['docs-hub', '/docs/', null],
  ['start-hub', '/start/', null],
  ['core-catalog', '/praxis/v0.7.2/examples/', ['praxis', 'v0.7.2']],
  ['core-operations', route('praxis', 'v0.7.2', 'examples/configs/operations'), ['praxis', 'v0.7.2']],
  ['core-hot-reload', route('praxis', 'v0.7.2', 'examples/configs/operations/hot-reload.yaml'), ['praxis', 'v0.7.2']],
  ['ai-flat-example', route('ai', 'v0.4.1', 'examples/configs/token-rate-limit.yaml'), ['ai', 'v0.4.1']],
  ['ai-responses-category', route('ai', 'v0.4.1', 'examples/configs/openai/responses'), ['ai', 'v0.4.1']],
  ['ai-responses-example', route('ai', 'v0.4.1', 'examples/configs/openai/responses/responses-proxy.yaml'), ['ai', 'v0.4.1']],
  ['core-v071-archive', route('praxis', 'v0.7.1', 'examples/configs/operations/container-default.yaml'), ['praxis', 'v0.7.1']],
  ['core-dev-example', route('praxis', 'dev', 'examples/configs/operations/hot-reload.yaml'), ['praxis', 'dev']],
];
const captured = new Set(['examples-hub', 'core-catalog', 'core-operations', 'core-hot-reload', 'ai-flat-example', 'ai-responses-example', 'core-v071-archive']);
const axePages = new Set(['examples-hub', 'core-catalog', 'core-hot-reload', 'ai-responses-example', 'core-v071-archive']);
const report = { base, pages: [], axe: [], redirects: [], interactions: [], screenshots: [], failures: [], failure: null };
let browser;
const attempt = async (label, work) => {
  try { await work(); } catch (error) { report.failures.push(`${label}: ${error.message}`); }
};

(async () => {
  fs.mkdirSync(output, { recursive: true });
  browser = await chromium.launch({ executablePath: process.env.QA_BROWSER_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  for (const theme of ['light', 'dark']) for (const width of [1440, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: width === 390 ? 844 : 1000 },
      isMobile: width === 390, hasTouch: width === 390, reducedMotion: 'reduce',
    });
    await context.addInitScript(value => localStorage.setItem('td-color-theme', value), theme);
    const page = await context.newPage();
    page.on('pageerror', error => report.pageErrors = [...(report.pageErrors || []), error.message]);
    try {
      for (const [name, url, product] of pages) await attempt(`${name}/${theme}/${width}`, async () => {
        const response = await page.goto(new URL(url, base).href, { waitUntil: 'networkidle' });
        assert.equal(response.status(), 200, `${name} HTTP status`);
        if (width === 390) {
          const toggle = page.locator('#td-sidebar-menu .td-sidebar__toggle');
          if (await toggle.count()) {
            await toggle.click();
            assert.equal(await toggle.getAttribute('aria-expanded'), 'true', `${name} mobile sidebar opens`);
            await page.waitForFunction(() => !document.querySelector('#td-section-nav')?.classList.contains('collapsing'));
          }
        }
        const state = await page.evaluate(() => {
          const text = e => (e?.innerText || e?.textContent || '').trim().replace(/\s+/g, ' ');
          const h1 = document.querySelector('main h1');
          const nav = document.querySelector('#td-section-nav');
          const current = [...(nav?.querySelectorAll('a[aria-current="page"]') || [])].map(a => new URL(a.href).pathname);
          const currentLink = nav?.querySelector('a[aria-current="page"]');
          const currentBox = currentLink?.getBoundingClientRect(), navBox = nav?.getBoundingClientRect();
          const version = document.querySelector('.docs-version-control select');
          const crumbs = document.querySelector('nav[aria-label="breadcrumb"]');
          const badDetails = [...(nav?.querySelectorAll('details') || [])].filter(d => {
            const children = [...d.children];
            return children[0]?.tagName !== 'SUMMARY' || !children.some(c => c.tagName === 'UL');
          }).length;
          const badLists = [...(nav?.querySelectorAll('ul') || [])].filter(ul => [...ul.children].some(li => li.tagName !== 'LI')).length;
          return {
            path: location.pathname, canonical: new URL(document.querySelector('link[rel="canonical"]').href).pathname,
            h1: text(h1), h1Count: document.querySelectorAll('main h1').length, titleTop: h1?.getBoundingClientRect().top,
            navbarBottom: document.querySelector('.td-navbar')?.getBoundingClientRect().bottom,
            width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
            overflowElements: document.documentElement.scrollWidth > innerWidth + 1 ? [...document.querySelectorAll('body *')].map(e => ({ e, r: e.getBoundingClientRect() })).filter(x => x.r.width > 0 && (x.r.right > innerWidth + 1 || x.r.left < -1)).slice(0, 8).map(({ e, r }) => ({ tag: e.tagName, id: e.id, cls: typeof e.className === 'string' ? e.className : '', left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width) })) : [],
            theme: document.documentElement.dataset.bsTheme,
            sidebarLabel: nav?.getAttribute('aria-label'), sidebarCurrent: current,
            sidebarLinks: [...(nav?.querySelectorAll('a[href]') || [])].map(a => new URL(a.href).pathname),
            currentBox: currentBox && { top: Math.round(currentBox.top), bottom: Math.round(currentBox.bottom) },
            sidebarViewport: nav && { top: Math.round(navBox.top), bottom: Math.round(navBox.top + nav.clientHeight), clientHeight: nav.clientHeight, scrollHeight: nav.scrollHeight },
            currentInSidebarViewport: !!currentBox && !!nav && currentBox.top >= navBox.top && currentBox.bottom <= navBox.top + nav.clientHeight,
            selectedVersion: version?.selectedOptions[0]?.textContent.trim(),
            selectedVersionPath: version?.value ? new URL(version.value, location.href).pathname : null,
            projectCurrent: [...document.querySelectorAll('.praxis-products-menu a[aria-current]')].map(a => ({ path: new URL(a.href).pathname, current: a.getAttribute('aria-current') })),
            crumbCurrent: text(crumbs?.querySelector('[aria-current="page"]')),
            crumbPaths: [...(crumbs?.querySelectorAll('a') || [])].map(a => new URL(a.href).pathname),
            openDetails: nav?.querySelectorAll('details[open]').length || 0,
            badDetails, badLists,
            guidePromos: [...document.querySelectorAll('header a[href*="visual-guides"],main a[href*="visual-guides"],footer a[href*="visual-guides"]')].map(a => new URL(a.href).pathname),
          };
        });
        report.pages.push({ name, theme, width, ...state });
        if (width === 1440 || captured.has(name)) {
          const file = `${name}-${theme}-${width}.png`;
          await page.screenshot({ path: path.join(output, file) });
          report.screenshots.push(file);
        }
        if (axePages.has(name)) {
          await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
          const findings = await page.evaluate(async () => (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] } })).violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.slice(0, 8).map(n => n.target) })));
          report.axe.push({ name, theme, width, findings });
          assert.equal(findings.length, 0, `${name} Axe ${theme}/${width}: ${JSON.stringify(findings)}`);
        }
        assert.equal(state.path, url, `${name} route`);
        assert.equal(state.canonical, url, `${name} canonical`);
        assert.equal(state.h1Count, 1, `${name} H1`);
        assert(state.titleTop >= state.navbarBottom, `${name} H1 overlaps navbar`);
        assert(state.scrollWidth <= width + 1, `${name} ${theme}/${width} overflow: ${state.scrollWidth}`);
        assert.equal(state.theme, theme, `${name} theme`);
        assert.equal(state.badDetails, 0, `${name} details need a leading summary and nested list`);
        assert.equal(state.badLists, 0, `${name} sidebar lists must contain only li children`);
        assert.deepEqual(state.guidePromos, [], `${name} promotes Visual guides in header, content, or footer`);
        if (product) {
          const [id, version] = product;
          if (width === 390) await page.locator('#td-section-nav a[aria-current="page"]').waitFor({ state: 'visible' });
          assert.equal(state.sidebarLabel, 'Examples navigation', `${name} sidebar context`);
          assert.equal(state.sidebarCurrent.length, 1, `${name} needs exactly one current sidebar link`);
          assert.equal(state.sidebarCurrent[0], state.canonical, `${name} sidebar current link/canonical`);
          assert(state.currentInSidebarViewport, `${name} current link must fit in the sidebar viewport without scrolling`);
          assert(state.sidebarLinks.every(href => href.startsWith(`/${id}/${version}/`)), `${name} sidebar leaves selected version`);
          assert.equal(state.selectedVersionPath, url, `${name} selected version route`);
          assert(state.selectedVersion.toLowerCase().includes(version === 'dev' ? 'development' : version), `${name} version label`);
          assert.equal(state.crumbCurrent, state.h1, `${name} final breadcrumb/H1`);
          assert.deepEqual(state.projectCurrent, [{ path: `/${id}/${defaults[id].default}/`, current: 'location' }], `${name} project docs context`);
          assert(state.crumbPaths.every(href => href === `/${id}/` || !href.startsWith(`/${id}/`) || href.startsWith(`/${id}/${version}/`)), `${name} breadcrumb leaves selected version`);
          const current = page.locator('#td-section-nav a[aria-current="page"]');
          await current.waitFor({ state: 'visible' });
          const branch = await current.evaluate(a => {
            const details = [];
            for (let d = a.closest('details'); d; d = d.parentElement.closest('details')) details.push(d.open);
            const li = a.closest('li');
            return { details, siblings: li ? li.parentElement.children.length - 1 : 0 };
          });
          if (name.includes('category')) assert(branch.details.length > 0, `${name} needs native open category ancestors`);
          assert(branch.details.every(Boolean), `${name} current-page ancestors must be open`);
          assert(branch.siblings > 0, `${name} current page must retain sibling links`);
        } else if (name === 'examples-hub') {
          assert.equal(state.h1, 'Configuration examples', 'Examples hub heading');
          const browseLabels = await page.locator('main a').allTextContents();
          assert(browseLabels.filter(x => /browse all/i.test(x)).every(x => !/\d/.test(x)), 'Examples hub browse labels must not depend on counts');
          assert.deepEqual(state.projectCurrent, [], 'Cross-project examples hub has no selected project');
        }
        if (width === 390) {
          const toggle = page.locator('#td-sidebar-menu .td-sidebar__toggle');
          if (await toggle.count()) {
            const box = await toggle.boundingBox();
            assert(box.width >= 44 && box.height >= 44, `${name} sidebar toggle touch target: ${JSON.stringify(box)}`);
          }
          const mainToggle = page.locator('.praxis-navbar-toggle');
          if (await mainToggle.isVisible()) {
            const box = await mainToggle.boundingBox();
            assert(box.width >= 44 && box.height >= 44, `${name} main menu touch target: ${JSON.stringify(box)}`);
          }
        }
      });

      if (theme === 'light' && width === 390) {
        await attempt('mobile keyboard', async () => {
        await page.goto(new URL('/praxis/v0.7.2/examples/', base).href);
        await page.keyboard.press('Tab');
        assert.equal(await page.evaluate(() => document.activeElement.getAttribute('href')), '#main-content', 'First keyboard stop is Skip to content');
        await page.locator('.praxis-navbar-toggle').focus();
        await page.keyboard.press('Enter');
        assert.equal(await page.locator('.praxis-navbar-toggle').getAttribute('aria-expanded'), 'true', 'Main menu keyboard toggle');
        report.interactions.push('Skip link and mobile menu keyboard activation');
        });
      }
      if (theme === 'light' && width === 1440) {
        await attempt('desktop redirects and journey', async () => {
        await page.locator('#praxis-theme-toggle').focus();
        await page.keyboard.press('Enter');
        await page.waitForFunction(() => document.documentElement.dataset.bsTheme === 'dark');
        await page.locator('#praxis-theme-toggle').click();
        await page.waitForFunction(() => document.documentElement.dataset.bsTheme === 'light');
        report.interactions.push('Theme button switches between light and dark with keyboard and pointer');
        for (const id of ['praxis', 'ai']) {
          const expected = `/${id}/${defaults[id].default}/`;
          const response = await page.goto(new URL(`/${id}/latest/`, base).href, { waitUntil: 'domcontentloaded' });
          assert.equal(response.status(), 200, `${id} latest alias status`);
          await page.waitForURL(url => new URL(url).pathname === expected);
          assert.equal(await page.locator('link[rel="canonical"]').evaluate(e => new URL(e.href).pathname), expected, `${id} latest canonical`);
          report.redirects.push({ route: `/${id}/latest/`, status: response.status(), landed: new URL(page.url()).pathname });
        }
        await page.goto(new URL('/examples/', base).href);
        const coreCatalog = '/praxis/v0.7.2/examples/';
        await page.locator(`a[href="${coreCatalog}"]`).first().click();
        await page.waitForURL(url => new URL(url).pathname === coreCatalog);
        const operations = route('praxis', 'v0.7.2', 'examples/configs/operations');
        await page.locator(`a[href="${operations}"]`).first().click();
        await page.waitForURL(url => new URL(url).pathname === operations);
        const hotReload = route('praxis', 'v0.7.2', 'examples/configs/operations/hot-reload.yaml');
        await page.locator(`a[href="${hotReload}"]`).first().click();
        await page.waitForURL(url => new URL(url).pathname === hotReload);
        const versionSelect = page.locator('.docs-version-control select');
        await versionSelect.selectOption({ label: 'v0.7.1' });
        const archiveHotReload = route('praxis', 'v0.7.1', 'examples/configs/operations/hot-reload.yaml');
        await page.waitForURL(url => new URL(url).pathname === archiveHotReload);
        assert.equal(await versionSelect.evaluate(e => new URL(e.value, location.href).pathname), archiveHotReload, 'Version switch must preserve the example');
        await versionSelect.selectOption({ label: 'v0.7.2' });
        await page.waitForURL(url => new URL(url).pathname === hotReload);
        const siblingHrefs = await page.locator('#td-section-nav a[href^="/praxis/v0.7.2/examples/configs/operations/"]').evaluateAll((links, current) => links.map(a => a.getAttribute('href')).filter(href => href !== current), hotReload);
        assert(siblingHrefs.length > 0, 'Hot Reload should expose a version-matched sibling in the sidebar');
        await page.locator(`#td-section-nav a[href="${siblingHrefs[0]}"]`).click();
        await page.waitForURL(url => new URL(url).pathname === siblingHrefs[0]);
        await page.locator(`#td-section-nav a[href="${coreCatalog}"]`).click();
        await page.waitForURL(url => new URL(url).pathname === coreCatalog);
        await page.goto(new URL(hotReload, base).href);
        const downloadPath = await page.locator('a[href*="/_assets/examples/"]').first().getAttribute('href');
        const downloaded = await context.request.get(new URL(downloadPath, base).href);
        assert.equal(downloaded.status(), 200, 'Pinned example download status');
        const body = await downloaded.body();
        assert.deepEqual(body, fs.readFileSync(path.join(root, 'public', new URL(downloadPath, base).pathname)), 'Served source bytes must match the generated file');
        report.interactions.push({ journey: ['Examples hub', 'Core catalog', 'Operations', 'Hot Reload'], download: downloadPath, sha256: crypto.createHash('sha256').update(body).digest('hex') });
        });
      }
    } finally {
      await context.close();
    }
  }
  assert.deepEqual(report.pageErrors || [], [], 'Browser page errors');
  assert.equal(report.failures.length, 0, report.failures.join('\n'));
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(`Examples journey passed: ${report.pages.length} route/theme/viewport cases; ${report.axe.length} Axe scans; ${report.screenshots.length} screenshots.`);
})().catch(error => {
  report.failure = error.message;
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  if (browser) await browser.close();
});
