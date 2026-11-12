/* Run with the isolated browser QA dependencies described in README.md. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const base = (process.env.QA_BASE_URL || 'http://127.0.0.1:18131/').replace(/\/?$/, '/');
const output = process.env.QA_OUTPUT || path.join(root, 'output/docs-audit');
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'data/docs_versions.json'))).products;
const sources = JSON.parse(fs.readFileSync(path.join(root, '.cache/docs-data/docs_sources.json')));
const url = route => new URL(route.replace(/^\//, ''), base).href;
const pathname = route => new URL(url(route)).pathname;
const sourceRoute = (product, version, source) => {
  const entry = sources.find(x => x.product === product && x.version === version && x.source_path === source);
  assert(entry, `Missing source ${product}/${version}/${source}`);
  return entry.url;
};

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.QA_BROWSER_PATH || '/usr/bin/google-chrome' });
  const report = [];
  try {
    for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
      await context.addInitScript(value => localStorage.setItem('td-color-theme', value), theme);
      const page = await context.newPage();
      page.setDefaultTimeout(10000);
      for (const width of [1440, 390, 320]) {
        console.log(`Checking ${theme}/${width}`);
        await page.setViewportSize({ width, height: width === 320 ? 740 : width === 390 ? 844 : 1000 });
        await page.goto(url('ai/container-quickstart/'));
        await page.locator('.docs-sidebar__identity').waitFor();
        assert((await page.locator('.docs-sidebar__identity').innerText()).includes(catalog.ai.default));
        assert.equal(await page.locator('[data-praxis-search]').getAttribute('data-praxis-search-default-version'), catalog.ai.default);
        assert.equal(await page.locator('#td-section-nav a[aria-current="page"]').count(), 1);
        assert.equal(await page.locator('#td-section-nav a[aria-current="page"]').getAttribute('href'), pathname('ai/container-quickstart/'));
        assert.equal(await page.locator('.navbar-brand img:visible').count(), 1, `One logo at ${theme}/${width}`);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `No page overflow at ${theme}/${width}`);
        assert((await page.locator('.docs-contribution-meta').innerText()).includes(catalog.ai.default));
        const image = `ai-${theme}-${width}.png`;
        await page.screenshot({ path: path.join(output, image) });
        report.push({ theme, width, image, version: catalog.ai.default });
        await page.getByRole('button', { name: 'Search documentation', exact: true }).click();
        const dialog = page.getByRole('dialog', { name: 'Search documentation', exact: true });
        await page.waitForFunction(expected => document.querySelector('dialog [name="version"]').value === expected, catalog.ai.default);
        await dialog.getByRole('searchbox').fill('Codex');
        await dialog.getByRole('button', { name: 'Search', exact: true }).click();
        await page.waitForFunction(() => document.querySelector('dialog [data-praxis-status]').textContent.includes('results'));
        const resultLinks = await dialog.locator('[data-praxis-results] a').evaluateAll(nodes => nodes.map(a => a.getAttribute('href')));
        assert(resultLinks.length > 0);
        assert(resultLinks.every(href => href.startsWith(pathname(`ai/${catalog.ai.default}/`))), 'Search must retain current release');
        await page.keyboard.press('Escape');
        assert.equal(await dialog.isVisible(), false);
        if (width < 768) {
          await page.getByRole('button', { name: 'Toggle section navigation' }).focus();
          await page.keyboard.press('Enter');
          await page.locator('#td-section-nav a[aria-current="page"]').waitFor({ state: 'visible' });
        }
      }
      await context.close();
    }
    const page = await browser.newPage();
    page.setDefaultTimeout(10000);
    await page.goto(url('ai/'));
    const intro = await page.locator('main').innerText();
    assert(intro.includes(`selected ${catalog.ai.default} release`));
    assert.equal(await page.getByRole('link', { name: 'release-matched security policy' }).getAttribute('href'), `https://github.com/praxis-proxy/ai/blob/${catalog.ai.default}/.github/SECURITY.md`);
    for (const product of ['praxis', 'ai']) {
      for (const version of [catalog[product].default, ...catalog[product].releases.filter(x => x.version !== catalog[product].default).map(x => x.version), 'dev']) {
        console.log(`Checking ${product}/${version}`);
        await page.goto(url(`${product}/${version}/`));
        const expectedStart = version === catalog[product].default ? (product === 'ai' ? '/ai/container-quickstart/' : '/guides/first-proxy/') : sourceRoute(product, version, 'docs/quickstart.md');
        assert(await page.locator(`main a[href="${pathname(expectedStart)}"]`).count(), `Primary start for ${product}/${version}`);
        const buildLinks = page.locator(`main a[href="${pathname(sourceRoute(product, version, 'docs/quickstart.md'))}"]`);
        assert((await buildLinks.allTextContents()).some(text => text.trim() === 'Build from source'), 'Source-build link is explicit');
        if (version !== catalog[product].default) {
          assert.equal(await page.locator('#td-section-nav a[href*="container-quickstart"], #td-section-nav a[href*="first-proxy"]').count(), 0);
        }
      }
    }
    await page.goto(url(''));
    assert.equal(await page.locator('footer').getByRole('link', { name: 'Praxis AI quickstart' }).getAttribute('href'), pathname('ai/container-quickstart/'));
    const examples = sources.filter(x => x.product === 'praxis' && x.version === catalog.praxis.default && x.source_path.startsWith('examples/configs/') && /\.ya?ml$/.test(x.source_path));
    await page.goto(url(`praxis/${catalog.praxis.default}/examples/configs/`));
    assert((await page.locator('main').innerText()).includes(`${examples.length} configurations in All configurations`));
    fs.writeFileSync(path.join(output, 'onboarding-check.json'), JSON.stringify({ base, report, checks: 'version context, search, navigation, source-build labels, example totals, responsive logos' }, null, 2));
    console.log(`Onboarding browser checks passed: ${base}`);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
