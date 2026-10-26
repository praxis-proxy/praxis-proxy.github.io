/* Focused responsive, accessibility, and interaction checks for the expanded docs journey.
 * Run against a built local site with isolated playwright@1.58.2 and axe-core@4.11.1. */
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const base = new URL(process.env.QA_BASE_URL || 'http://127.0.0.1:18131/');
if (!base.pathname.endsWith('/')) base.pathname += '/';
const output = process.env.QA_OUTPUT || path.join(root, 'output/playwright');
const widths = [320, 390, 768, 1024, 1440, 1900];
const themes = ['light', 'dark'];
const axePath = require.resolve('axe-core/axe.min.js');
const pages = [
  ['tutorial', 'guides/first-proxy/', 'Run your first reverse proxy'],
  ['capabilities', 'praxis/capabilities/', 'Praxis v0.7.2 capabilities and support'],
  ['examples', 'examples/', 'Configuration examples'],
  ['visual-index', 'visual-guides/', 'Visual guides'],
  ['visual-praxis', 'visual-guides/praxis/', 'Praxis request flow'],
  ['visual-ai', 'visual-guides/ai/', 'Inside Praxis AI'],
  ['visual-policy', 'visual-guides/policy/', 'Policy decisions and effects'],
];

const url = (route) => new URL(route.replace(/^\/+/, ''), base).href;
const report = { pages: [], accessibility: [], interactions: [], errors: [], screenshots: [] };
const checkedImages = new Set();
let browser;
let activePage = '';

function recordPageErrors(page) {
  page.on('pageerror', (error) => report.errors.push({ page: activePage, message: error.message }));
}

async function openPage(page, key, route) {
  activePage = key;
  const response = await page.goto(url(route), { waitUntil: 'domcontentloaded' });
  assert.equal(response?.status(), 200, `${route} HTTP status`);
  await page.locator('h1').waitFor();
}

async function checkImages(page, key) {
  const sources = await page.locator('img').evaluateAll((items) => items.map((image) => image.currentSrc || image.src));
  for (const source of sources) {
    const imageURL = new URL(source, page.url());
    if (imageURL.origin !== base.origin || checkedImages.has(imageURL.href)) continue;
    checkedImages.add(imageURL.href);
    const response = await page.context().request.get(imageURL.href);
    assert.equal(response.status(), 200, `${key} image failed: ${imageURL.pathname}`);
  }
  return sources.filter((source) => new URL(source, page.url()).origin === base.origin);
}

async function runAxe(page, key, theme, width) {
  await page.addScriptTag({ path: axePath });
  const findings = await page.evaluate(async () => {
    const result = await axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] },
    });
    return result.violations.map((issue) => ({
      id: issue.id,
      impact: issue.impact,
      description: issue.description,
      nodes: issue.nodes.map((node) => ({ target: node.target, summary: node.failureSummary })),
    }));
  });
  report.accessibility.push({ page: key, theme, width, findings });
  assert.equal(findings.length, 0, `${key} axe violations at ${theme}/${width}: ${JSON.stringify(findings)}`);
}

async function capture(page, key, theme, width) {
  const name = `next-${key}-${theme}-${width}.png`;
  const file = path.join(output, name);
  await page.screenshot({ path: file });
  report.screenshots.push(name);
}

async function checkResponsivePages() {
  for (const theme of themes) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: 'reduce',
    });
    await context.addInitScript((value) => localStorage.setItem('td-color-theme', value), theme);
    const page = await context.newPage();
    recordPageErrors(page);
    try {
      for (const width of widths) {
        await page.setViewportSize({ width, height: 1000 });
        for (const [key, route, expectedTitle] of pages) {
          await openPage(page, key, route);
          const sameOriginImages = await checkImages(page, key);
          const result = await page.evaluate(() => ({
            h1: document.querySelectorAll('h1').length,
            title: document.querySelector('h1')?.textContent.trim(),
            titleTop: document.querySelector('h1')?.getBoundingClientRect().top,
            navbarBottom: document.querySelector('.td-navbar')?.getBoundingClientRect().bottom,
            navbarHeight: document.querySelector('.td-navbar')?.getBoundingClientRect().height,
            width: innerWidth,
            scrollWidth: document.documentElement.scrollWidth,
            theme: document.documentElement.dataset.bsTheme,
            reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
            flowModules: performance.getEntriesByType('resource').filter((entry) => entry.name.includes('flow-walkthrough')).map((entry) => entry.name),
          }));
          const entry = { page: key, route, theme, width, sameOriginImages, ...result };
          report.pages.push(entry);
          assert.equal(result.theme, theme, `${route} requested theme`);
          assert.equal(result.h1, 1, `${route} must have one H1`);
          assert.equal(result.title, expectedTitle, `${route} title`);
          assert(result.titleTop >= result.navbarBottom, `${route} title overlaps navbar at ${width}px`);
          assert(result.navbarHeight <= 80, `${route} navbar wraps at ${width}px`);
          assert(result.scrollWidth <= width + 1, `${route} ${theme}/${width}px overflows: ${result.scrollWidth}`);
          assert.equal(result.reducedMotion, true, `${route} must honor reduced-motion context`);
          if (key === 'visual-ai') assert.equal(result.flowModules.length, 0, 'Player module loaded before opening the disclosure');
          if (key !== 'visual-ai') assert.equal(result.flowModules.length, 0, `${route} fetched the optional player module`);

          if ([390, 1440].includes(width)) {
            await capture(page, key, theme, width);
            await runAxe(page, key, theme, width);
          }
        }
      }
    } finally {
      await context.close();
    }
  }
}

async function checkMobileNavigation() {
  const context = await browser.newContext({ viewport: { width: 320, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  recordPageErrors(page);
  try {
    await openPage(page, 'mobile-navigation', '');
    const expected = [['Blog', 'blog/'], ['Community', 'community/']];
    for (const [label, route] of expected) {
      await page.goto(url(''));
      await page.locator('.praxis-navbar-toggle').click();
      const link = page.locator('#praxis-navbar-menu a').filter({ hasText: label }).first();
      await link.waitFor({ state: 'visible' });
      assert.equal(new URL(await link.getAttribute('href'), page.url()).pathname, new URL(route, base).pathname, `${label} mobile nav href`);
      await link.click();
      await page.waitForURL(url(route));
      assert.equal(new URL(page.url()).pathname, new URL(route, base).pathname, `${label} mobile nav destination`);
    }

    await page.goto(url(''));
    await page.locator('.praxis-navbar-toggle').click();
    await page.locator('#products-menu').click();
    const project = page.locator('.praxis-products-menu a').first();
    await project.waitFor({ state: 'visible' });
    assert.equal(new URL(await project.getAttribute('href'), page.url()).pathname, new URL('praxis/v0.7.2/', base).pathname, 'Praxis docs nav href');
    await project.click();
    await page.waitForURL(url('praxis/v0.7.2/'));
    report.interactions.push('Mobile menu reaches Blog, Community, and the selected Praxis documentation.');
  } finally {
    await context.close();
  }
}

async function checkSearchStates() {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  recordPageErrors(page);
  try {
    await openPage(page, 'search-states', '');
    await page.route('**/*', (route) => new URL(route.request().url()).pathname.includes('/search-index/') ? route.abort() : route.continue());
    await page.locator('.praxis-search-trigger').click();
    const dialog = page.locator('#praxis-search-dialog');
    await dialog.waitFor({ state: 'visible' });
    const input = dialog.locator('[data-praxis-query]');
    await input.fill('configuration');
    await input.press('Enter');
    await dialog.locator('[data-praxis-status][data-state="error"]').waitFor();
    assert(await dialog.locator('[data-praxis-retry]').isVisible(), 'Search failure must offer retry');
    await page.unroute('**/*');
    await dialog.locator('[data-praxis-retry]').click();
    await dialog.locator('[data-praxis-results] li a').first().waitFor();
    await input.fill('zxqvnotfound');
    await input.press('Enter');
    await dialog.locator('[data-praxis-status][data-state="empty"]').waitFor();
    assert.equal(await dialog.locator('[data-praxis-results] li').count(), 0, 'Empty query result must clear matches');
    report.interactions.push('Search network failure, retry recovery, and no-results state.');
  } finally {
    await context.close();
  }
}

async function checkWalkthrough() {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  });
  await context.addInitScript(() => {
    window.__qaFrames = 0;
    const requestFrame = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) => {
      window.__qaFrames++;
      return requestFrame(callback);
    };
  });
  const page = await context.newPage();
  recordPageErrors(page);
  try {
    await openPage(page, 'walkthrough', 'visual-guides/ai/');
    assert.equal(await page.locator('[data-flow-step][data-scenario="primary"]').count(), 5, 'Static primary sequence');
    assert.equal(await page.locator('[data-flow-step][data-scenario="fallback"]').count(), 8, 'Static fallback sequence');
    assert.equal(await page.locator('[data-flow-controls]').evaluate((element) => element.hidden), true, 'Controls start hidden until module init');
    const details = page.locator('details[data-flow-walkthrough]');
    assert.equal(await details.evaluate((element) => element.open), false, 'Player must begin paused and closed');
    assert.equal(await page.evaluate(() => performance.getEntriesByType('resource').some((entry) => entry.name.includes('flow-walkthrough'))), false, 'Module must not load before opening');
    const baselineFrames = await page.evaluate(() => window.__qaFrames);

    await details.locator('summary').focus();
    await page.keyboard.press('Enter');
    const controls = page.locator('[data-flow-controls]');
    await controls.waitFor({ state: 'visible' });
    await page.waitForFunction(() => performance.getEntriesByType('resource').some((entry) => entry.name.includes('flow-walkthrough')));
    assert(await page.evaluate(() => performance.getEntriesByType('resource').some((entry) => entry.name.includes('flow-walkthrough'))), 'Opening the player must load its module');
    await page.keyboard.press('Tab');
    assert(await page.locator('.flow-walkthrough__view').evaluate((element) => element === document.activeElement), 'Keyboard focus should move from summary to the scrollable diagram');
    await page.keyboard.press('Tab');
    assert(await page.locator('input[name="flow-scenario"][value="primary"]').evaluate((element) => element === document.activeElement), 'Keyboard focus should move from diagram to scenario');
    await page.keyboard.press('ArrowDown');
    await page.locator('[data-flow-status]').filter({ hasText: 'Primary returns a retryable status. Step 1 of 8' }).waitFor();
    await page.keyboard.press('Tab');
    assert(await page.locator('[data-flow-action="next"]').evaluate((element) => element === document.activeElement), 'Keyboard focus should reach Next');
    await page.keyboard.press('Enter');
    await page.locator('[data-flow-status]').filter({ hasText: 'Step 2 of 8' }).waitFor();
    await page.locator('[data-flow-action="previous"]').focus();
    await page.keyboard.press('Enter');
    await page.locator('[data-flow-status]').filter({ hasText: 'Step 1 of 8' }).waitFor();
    await page.locator('[data-flow-action="next"]').focus();
    await page.keyboard.press('Enter');
    await page.locator('[data-flow-action="reset"]').focus();
    await page.keyboard.press('Enter');
    await page.locator('[data-flow-status]').filter({ hasText: 'Step 1 of 8' }).waitFor();
    await page.locator('input[name="flow-scenario"][value="fallback"]').focus();
    await page.keyboard.press('ArrowUp');
    await page.locator('[data-flow-status]').filter({ hasText: 'Primary succeeds. Step 1 of 5' }).waitFor();

    await page.waitForTimeout(250);
    const motion = await page.locator('.flow-walkthrough').evaluate((element) => ({
      reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
      running: element.getAnimations({ subtree: true }).filter((animation) => animation.playState === 'running').length,
    }));
    assert.equal(motion.reduced, true, 'Player test must run with reduced motion');
    assert.equal(motion.running, 0, 'Player must have no running animations');
    const frameCount = await page.evaluate(() => window.__qaFrames);
    assert(frameCount - baselineFrames <= 2, `Player must not run an idle animation loop (RAF delta ${frameCount - baselineFrames})`);
    await runAxe(page, 'walkthrough-open', 'light', 390);
    await capture(page, 'walkthrough-open', 'light', 390);
    report.interactions.push('Player lazy-load, scenario radios, Previous/Next/Reset keyboard controls, live step status, reduced motion, and idle-frame check.');
  } finally {
    await context.close();
  }

  const homeContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const home = await homeContext.newPage();
  try {
    await openPage(home, 'home-player-payload', '');
    assert.equal(await home.evaluate(() => performance.getEntriesByType('resource').some((entry) => entry.name.includes('flow-walkthrough'))), false, 'Homepage must not fetch the optional walkthrough module');
    report.interactions.push('Homepage does not fetch the optional AI walkthrough module.');
  } finally {
    await homeContext.close();
  }

  const noScriptContext = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const noScriptPage = await noScriptContext.newPage();
  try {
    await openPage(noScriptPage, 'walkthrough-no-javascript', 'visual-guides/ai/');
    for (const [scenario, count] of [['primary', 5], ['fallback', 8]]) {
      const steps = noScriptPage.locator(`[data-flow-step][data-scenario="${scenario}"]`);
      assert.equal(await steps.count(), count, `No-JS ${scenario} steps`);
      assert.equal(await steps.first().evaluate((item) => item.closest('ol')?.tagName), 'OL', `No-JS ${scenario} must be an ordered list`);
      assert(await steps.evaluateAll((items) => items.every((item) => item.textContent.trim() && item.getBoundingClientRect().height > 0)), `No-JS ${scenario} list must be complete and visible`);
    }
    assert.equal(await noScriptPage.locator('[data-flow-controls]').evaluate((element) => element.hidden), true, 'No-JS controls must remain hidden');
    report.interactions.push('JavaScript-disabled fallback retains both complete ordered paths and static SVG.');
  } finally {
    await noScriptContext.close();
  }

  const blockedContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const blockedPage = await blockedContext.newPage();
  try {
    let blocked = false;
    await blockedPage.route('**/*', (route) => {
      if (new URL(route.request().url()).pathname.includes('flow-walkthrough')) {
        blocked = true;
        return route.abort();
      }
      return route.continue();
    });
    await openPage(blockedPage, 'walkthrough-module-blocked', 'visual-guides/ai/');
    await blockedPage.locator('details[data-flow-walkthrough] summary').click();
    await blockedPage.getByText('Interactive controls could not load. Read the complete steps below, or reload this page to try again.').waitFor();
    assert.equal(blocked, true, 'Player module request should be intercepted');
    assert.equal(await blockedPage.locator('[data-flow-controls]').evaluate((element) => element.hidden), true, 'Blocked module must not expose inert controls');
    assert.equal(await blockedPage.locator('[data-flow-step][data-scenario="fallback"]').count(), 8, 'Blocked-module static story');
    report.interactions.push('Blocked player module shows an error and preserves static story without inert controls.');
  } finally {
    await blockedContext.close();
  }
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  report.baseURL = base.href;
  report.widths = widths;
  report.themes = themes;
  browser = await chromium.launch({ executablePath: process.env.QA_BROWSER_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  report.browser = await browser.version();
  try {
    await checkResponsivePages();
    await checkMobileNavigation();
    await checkSearchStates();
    await checkWalkthrough();
    assert.equal(report.errors.length, 0, `Browser errors: ${JSON.stringify(report.errors)}`);
    report.result = 'passed';
    console.log(`Next-experience checks passed: ${report.pages.length} responsive cases, ${report.accessibility.length} axe scans.`);
  } finally {
    report.result ||= 'failed';
    fs.writeFileSync(path.join(output, 'next-report.json'), JSON.stringify(report, null, 2));
    if (browser) await browser.close();
  }
})().catch((error) => {
  report.result = 'failed';
  report.failure = error.stack || error.message;
  try {
    fs.mkdirSync(output, { recursive: true });
    fs.writeFileSync(path.join(output, 'next-report.json'), JSON.stringify(report, null, 2));
  } catch (writeError) {
    console.error(`Could not write next-report.json: ${writeError.message}`);
  }
  console.error(error);
  process.exitCode = 1;
});
