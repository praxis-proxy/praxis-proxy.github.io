/* Run using the isolated Playwright/Axe setup in README.md. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright');
const root = path.resolve(__dirname, '..');
const base = new URL(process.env.QA_BASE_URL || 'http://127.0.0.1:18131/');
const url = route => new URL(route.replace(/^\//, ''), base).href;
const defaults = JSON.parse(fs.readFileSync(path.join(root, 'data/docs_versions.json'))).products;
const sources = JSON.parse(fs.readFileSync(path.join(root, '.cache/docs-data/docs_sources.json')));
const source = (version, file) => {
  const match = sources.find(x => x.product === 'ai' && x.version === version && x.source_path === file);
  assert(match, file); return match.url;
};
(async () => {
  const browser = await chromium.launch({executablePath: process.env.QA_BROWSER_PATH});
  let cases = 0, scans = 0;
  try {
    for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({reducedMotion:'reduce'});
      await context.addInitScript(t => localStorage.setItem('td-color-theme',t), theme);
      const page = await context.newPage();
      for (const width of [320,390,1440]) {
        await page.setViewportSize({width,height:1000});
        for (const version of [defaults.ai.default,'dev']) {
          await page.goto(url(`ai/${version}/`));
          const cards = page.locator('.ai-discovery__cards a');
          assert.equal(await cards.count(),10);
          for (const href of await cards.evaluateAll(links => links.map(a => a.href))) {
            assert(new URL(href).pathname.includes(`/ai/${version}/`), href);
          }
          await cards.filter({hasText:'Anthropic Messages'}).click();
          assert.equal(new URL(page.url()).pathname, new URL(url(source(version, version==='dev'?'docs/recipes/anthropic.md':'docs/anthropic-messages.md'))).pathname);
          await page.locator('#td-section-nav a[aria-current="page"]').waitFor({state:'attached'});
          assert.equal(await page.locator('#td-section-nav a[aria-current="page"]').count(),1);
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth>innerWidth+1),false);
          cases++;
        }
      }
      for (const file of ['providers','routing','guardrails-token-usage','managed-responses']) {
        await page.goto(url(source('dev',`docs/recipes/${file}.md`)));
        assert.equal(await page.locator('#td-section-nav a[aria-current="page"]').count(),1);
        assert((await page.locator('.docs-version-banner').innerText()).includes('Unreleased'));
        assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'),'noindex, follow');
        cases++;
      }
      await page.goto(url('ai/dev/'));
      await page.keyboard.press('Control+k');
      await page.waitForFunction(() => document.querySelector('#praxis-search-dialog [data-praxis-version]').value==='dev');
      const query=page.locator('#praxis-search-dialog [data-praxis-query]');
      await query.fill('guardrails');await query.press('Enter');
      await page.locator('#praxis-search-dialog [data-praxis-results] li a').first().waitFor();
      const results=await page.locator('#praxis-search-dialog [data-praxis-results] li a').evaluateAll(a=>a.map(x=>x.href));
      assert(results.every(h=>(new URL(h).pathname.includes('/ai/dev/') || new URL(h).pathname===new URL(url('ai/')).pathname)), JSON.stringify(results));
      assert(results.some(h=>new URL(h).pathname.includes('/recipes/guardrails-token-usage/')));
      await page.keyboard.press('Escape');
      await page.goto(url(source('dev','docs/recipes/managed-responses.md')));
      await page.locator('.docs-version-control select').selectOption(new URL(url(`ai/${defaults.ai.default}/`)).pathname);
      await page.waitForURL(u=>u.pathname===new URL(url(`ai/${defaults.ai.default}/`)).pathname && u.searchParams.has('version_fallback'));
      await page.locator('.docs-version-fallback[role="status"]').waitFor({state:'visible'});
      await page.goto(url('ai/dev/'));
      await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
      const issues = await page.evaluate(async () => (await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations);
      assert.equal(issues.length,0,JSON.stringify(issues.map(x=>x.id))); scans++;
      const out=process.env.QA_OUTPUT||path.join(root,'output/ai-discovery');fs.mkdirSync(out,{recursive:true});
      await page.screenshot({path:path.join(out,`ai-dev-${theme}.png`)});
      await context.close();
    }
    const context=await browser.newContext({javaScriptEnabled:false});
    const page=await context.newPage();await page.goto(url('ai/dev/'));
    await page.locator('.ai-discovery__cards a').filter({hasText:'Route models'}).click();
    assert.equal(new URL(page.url()).pathname,new URL(url(source('dev','docs/recipes/routing.md'))).pathname);
    await context.close();
    console.log(`AI discovery passed: ${cases} journeys/pages, ${scans} Axe scans, no-JavaScript recipe traversal.`);
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
