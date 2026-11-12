/* Run with the isolated Playwright and Axe tools described in README.md. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const base = new URL((process.env.QA_BASE_URL || 'http://127.0.0.1:18131/').replace(/\/?$/, '/'));
const output = process.env.QA_OUTPUT || path.join(root, 'output/docs-journey');
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'data/docs_versions.json'))).products;
const url = route => new URL(route.replace(/^\//, ''), base).href;
const routePath = route => new URL(url(route)).pathname;
const report = { pages: [], axe: [], journeys: [] };
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.QA_BROWSER_PATH || '/usr/bin/google-chrome' });
  try {
    const routes = ['docs/', `ai/${catalog.ai.default}/`, 'ai/dev/', 'ai/dev/quickstart/', 'ai/dev/client-provider-paths/', `praxis/${catalog.praxis.default}/`, 'praxis/dev/', 'praxis/dev/quickstart/', 'guides/first-proxy/', 'guides/use-filters/', `policy/${catalog.policy.default}/`, 'ai/v0.7.0/'];
    for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({ reducedMotion: 'reduce' });
      await context.addInitScript(value => localStorage.setItem('td-color-theme', value), theme);
      const page = await context.newPage();
      page.setDefaultTimeout(10000);
      for (const width of [320, 390, 768, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        for (const route of routes) {
          const response = await page.goto(url(route), { waitUntil: 'domcontentloaded' });
          assert.equal(response.status(), 200, route);
          await page.locator('h1').waitFor();
          const state = await page.evaluate(() => ({
            overflow: document.documentElement.scrollWidth > innerWidth + 1,
            headingCount: document.querySelectorAll('main h1').length,
            titleTop: document.querySelector('h1').getBoundingClientRect().top,
            project: document.querySelector('.docs-project-control select')?.id,
            projectTarget: document.querySelector('.docs-project-control select')?.value,
            globalLinks: [...document.querySelectorAll('#praxis-navbar-menu a')].map(a => a.textContent.trim()),
            navbarBottom: document.querySelector('.td-navbar').getBoundingClientRect().bottom,
            current: [...document.querySelectorAll('#td-section-nav a[aria-current="page"]')].map(a => a.pathname),
          }));
          assert.deepEqual(state.globalLinks, ['Docs', 'Blog', 'Community']);
          if (route !== 'docs/') {
            assert(state.project, `Project selector ${route}`);
            assert.equal(new URL(state.projectTarget, page.url()).pathname, routePath(route));
          }
          assert(!state.overflow, `Overflow ${route}/${theme}/${width}`);
          assert.equal(state.headingCount, 1, route);
          assert(state.titleTop >= state.navbarBottom, `Title hidden by header ${route}`);
          if (route !== 'docs/') assert.deepEqual(state.current, [routePath(route)], `Selected page ${route}`);
          if (['docs/', 'ai/dev/', 'ai/dev/quickstart/'].includes(route) && [390, 1440].includes(width)) {
            await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
            const issues = await page.evaluate(async () => (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] } })).violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) })));
            report.axe.push({ route, theme, width, issues });
            assert.deepEqual(issues, []);
          }
          report.pages.push({ route, theme, width, ...state });
          if (['docs/', 'ai/dev/', 'ai/dev/quickstart/'].includes(route) && [390, 1440].includes(width)) {
            await page.screenshot({ path: path.join(output, `${route.replaceAll('/', '-')}${theme}-${width}.png`) });
          }
        }
      }
      // Walk the actual visible project path and follow its explicit Development entry.
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.goto(url(''));
      await page.locator('nav[aria-label="Main navigation"]').getByRole('link', { name: 'Docs', exact: true }).click();
      assert.equal(new URL(page.url()).pathname, routePath('docs/'));
      const aiStart = page.locator(`main a.task-card__action[href="${routePath('ai/container-quickstart/')}"]`);
      await aiStart.click();
      await page.getByRole('navigation', { name: 'Next step', exact: true }).getByRole('link').click();
      assert.equal(new URL(page.url()).pathname, routePath(`ai/${catalog.ai.default}/features/`));
      await page.goto(url(`ai/${catalog.ai.default}/`));
      await page.getByRole('link', { name: 'Preview the unreleased guide' }).click();
      assert.equal(new URL(page.url()).pathname, routePath('ai/dev/quickstart/'));
      assert((await page.locator('.docs-version-banner').innerText()).includes('Unreleased'));
      await page.getByRole('navigation', { name: 'Next step', exact: true }).getByRole('link').click();
      assert.equal(new URL(page.url()).pathname, routePath('ai/dev/client-provider-paths/'));
      assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'), 'noindex, follow');
      await page.goto(url(`ai/${catalog.ai.default}/#architecture`));
      await page.locator('#architecture').waitFor({ state: 'visible' });
      assert(await page.locator('.docs-source-index').getAttribute('open') !== null, 'Historical fragment opens retained source index');
      await page.goto(url(`praxis/${catalog.praxis.default}/`));
      await page.getByRole('link', { name: 'Preview the unreleased guide' }).click();
      assert.equal(new URL(page.url()).pathname, routePath('praxis/dev/quickstart/'));
      assert((await page.locator('.docs-version-banner').innerText()).includes('Unreleased'));
      assert((await page.locator('main').innerText()).includes('local-backend'));
      await page.goto(url('guides/first-proxy/'));
      await page.getByRole('navigation', { name: 'Next step', exact: true }).getByRole('link').click();
      assert.equal(new URL(page.url()).pathname, routePath('guides/use-filters/'));
      await page.goto(url('ai/dev/quickstart/'));
      await page.locator('.docs-project-control select').selectOption(routePath(`policy/${catalog.policy.default}/`));
      await page.waitForURL(url(`policy/${catalog.policy.default}/`));
      await page.locator('.docs-project-control select').selectOption(routePath(`praxis/${catalog.praxis.default}/`));
      await page.waitForURL(url(`praxis/${catalog.praxis.default}/`));
      await page.locator('.docs-version-control select').selectOption(routePath('praxis/dev/'));
      await page.waitForURL(url('praxis/dev/'));
      assert.equal(await page.locator('.docs-project-control select').getAttribute('id'), 'docs-project-praxis');
      report.journeys.push({ theme, passed: true });
      await context.close();
    }
    const noJS = await browser.newContext({ javaScriptEnabled: false });
    const staticPage = await noJS.newPage();
    await staticPage.goto(url('ai/dev/'));
    await staticPage.locator('.docs-source-index > summary').focus();
    await staticPage.keyboard.press('Enter');
    assert(await staticPage.locator('#architecture').isVisible(), 'Source index works without JavaScript');
    assert(await staticPage.locator('.docs-journey__steps a').count() > 0);
    assert.equal(await staticPage.getByRole('navigation', {name: 'Choose documentation project'}).getByRole('link').count(), 4);
    await noJS.close();
    // All-project search must not expose unreleased provider-selector content.
    const indexes = fs.readdirSync(path.join(root, 'public/search-index')).filter(f => f.startsWith('all-defaults'));
    const docs = JSON.parse(fs.readFileSync(path.join(root, 'public/search-index', indexes[0])));
    assert(!docs.some(d => d.version === 'dev'), 'Development excluded from default search');
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
    console.log(`Reader journeys passed: ${report.pages.length} viewport/theme/route cases, ${report.axe.length} Axe scans, ${report.journeys.length} end-to-end journeys.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
