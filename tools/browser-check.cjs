/* Run with NODE_PATH pointing to isolated playwright@1.58.2 and axe-core@4.11.1.
 * Start a server for public/ first. No website runtime dependency is added. */
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const base = process.env.QA_BASE_URL || 'http://127.0.0.1:18131';
const out = process.env.QA_OUTPUT || '/tmp/praxis-redesign-qa';
fs.mkdirSync(out, { recursive: true });
const root = path.resolve(__dirname, '..');
const sources = JSON.parse(fs.readFileSync(path.join(root, '.cache/docs-data/docs_sources.json')));
const find = (product, version, file) => {
  const entry = sources.find(x => x.product === product && x.version === version && x.source_path === file);
  assert(entry, `No source mapping for ${product}/${version}/${file}`);
  return entry.url;
};
const routes = [
  ['home', '/'], ['overview', '/praxis/'], ['ai-overview', '/ai/'], ['policy-overview', '/policy/'], ['start', '/start/'],
  ['directory','/docs/'], ['policy-svg', find('policy','v0.4.0','docs/content/overview.md')],
  ['user-guide','/guides/use-filters/'], ['guides','/guides/'],
  ['examples','/praxis/v0.7.2/examples/'],
  ['example',find('praxis','v0.7.2','examples/configs/operations/hot-reload.yaml')],
  ['tutorial', find('praxis','v0.7.2','docs/filters/http-filter-tutorial.md')],
  ['how-to', find('praxis','v0.7.2','docs/quickstart.md')],
  ['reference', find('praxis','v0.7.2','docs/filters/reference.md')],
  ['explanation', find('praxis','v0.7.2','docs/architecture/overview.md')],
  ['archive', find('praxis','v0.7.1','docs/quickstart.md')],
  ['development', find('praxis','dev','docs/quickstart.md')],
];
(async () => {
  const browser = await chromium.launch({executablePath:process.env.QA_BROWSER_PATH || '/usr/bin/google-chrome', args:['--no-sandbox']});
  const context = await browser.newContext({ viewport:{width:1440,height:1000}, reducedMotion:'reduce' });
  const page = await context.newPage();
  const report = { browser:await browser.version(), matrix:[], accessibility:[], interactions:[] };
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  try {
    if (!process.env.QA_INTERACTIONS_ONLY) for (const theme of ['light','dark']) {
      await page.goto(base+'/');
      await page.evaluate(value => localStorage.setItem('td-color-theme', value), theme);
      for (const width of [320,390,768,1024,1440]) {
        await page.setViewportSize({width,height:1000});
        for (const [name,route] of routes) {
          const response=await page.goto(base+route, {waitUntil:'networkidle'});
          assert.equal(response.status(),200,`${route} HTTP status`);
          if (name === 'explanation') await page.waitForSelector('.mermaid svg');
          const result = await page.evaluate(() => ({
            h1:document.querySelectorAll('h1').length,
            brokenImages:[...document.images].filter(x=>new URL(x.src).origin===location.origin && (!x.complete || !x.naturalWidth)).map(x=>x.src),
            width:innerWidth, scrollWidth:document.documentElement.scrollWidth,
            theme:document.documentElement.dataset.bsTheme,
            titleTop:document.querySelector('h1').getBoundingClientRect().top,
            navbarBottom:document.querySelector('.td-navbar').getBoundingClientRect().bottom,
            navbarHeight:document.querySelector('.td-navbar').getBoundingClientRect().height,
            eagerSearch:performance.getEntriesByType('resource').filter(x=>/search.*\.json/.test(x.name)).map(x=>x.name),
          }));
          report.matrix.push({name,route,theme,width,...result});
          if (name === 'home' || (['overview','directory','examples'].includes(name) && width === 1440) || (['how-to','user-guide','example'].includes(name) && [390,1440].includes(width))) {
            await page.screenshot({path:path.join(out,`${name}-${theme}-${width}.png`),fullPage:true});
          }
          assert.equal(result.theme,theme,`${route} requested appearance`);
          assert.equal(result.h1,1,`${route} H1 count`);
          assert(result.titleTop>=result.navbarBottom,`${route} title overlaps the navbar at ${width}px`);
          assert(result.navbarHeight<=80,`${route} navbar wraps unexpectedly at ${width}px`);
          if (name === 'home') {
            const buttons=await page.locator('.home-hero__actions .btn').evaluateAll(items=>items.map(x=>({left:x.getBoundingClientRect().left,right:x.getBoundingClientRect().right})));
            assert(buttons.every(x=>x.left>=0 && x.right<=width+1), 'Hero actions must fit the viewport');
          }
          if (name==='how-to') {
            assert.equal(await page.locator('.docs-sidebar__identity').count(),1,'Sidebar names the selected project and release');
            assert.equal(await page.locator('.docs-sidebar-topic > span').filter({hasText:/^Examples$/}).count(),0,'Individual examples belong in the catalog, not the shared sidebar');
            assert.equal(await page.locator('#td-section-nav a').filter({hasText:/^Configuration examples$/}).count(),1,'Sidebar exposes the versioned example catalog');
            const topics=await page.locator('#docs-need-praxis-how-to').locator('..').locator('.docs-sidebar-topic > span').allTextContents();
            assert(topics.indexOf('First Proxy')<topics.indexOf('Operating') && topics.indexOf('Operating')<topics.indexOf('Developing'),'Getting started and operations must precede development');
          }
          if (name==='user-guide') {
            assert.equal(await page.locator('#td-section-nav a[aria-current="page"]').count(),1,'Guide has one current sidebar link');
            assert.equal(await page.locator('#td-section-nav a[aria-current="page"]').getAttribute('href'),'/guides/use-filters/','Guide sidebar selects the exact page');
            if (width===390) {
              await page.locator('#td-sidebar-menu .td-sidebar__toggle').click();
              assert(await page.locator('#td-section-nav a[aria-current="page"]').isVisible(),'Guide navigation opens on mobile');
            }
          }
          if (['overview','ai-overview','policy-overview'].includes(name)) {
            const positions=await page.evaluate(()=>['h1','.site-page > article > p','.product-overview__intro','.product-visual'].map(selector=>document.querySelector(selector).getBoundingClientRect().left));
            assert(positions.every(left=>Math.abs(left-positions[0])<=1),'Project heading, prose, actions, and diagram must share an alignment');
          }
          assert.equal(result.brokenImages.length,0,`${route} broken images: ${result.brokenImages}`);
          assert(result.scrollWidth <= width+1,`${route} ${theme} ${width}px overflow: ${result.scrollWidth}`);
          assert.equal(result.eagerSearch.length,0,`${route} eagerly fetches a search index`);
          if (['home','how-to','overview','start','directory','policy-svg','tutorial','reference','explanation','user-guide','guides','example','examples'].includes(name) && [390,1440].includes(width)) {
            await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
            const findings = await page.evaluate(async()=>{
              const results=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}});
              return results.violations.map(x=>({id:x.id,impact:x.impact,description:x.description,nodes:x.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}));
            });
            report.accessibility.push({name,theme,width,findings});
          }
        }
      }
    }
    for (const width of [320,390,768,1440,1900]) {
      await page.setViewportSize({width,height:1000});
      await page.goto(base+'/praxis/');
      await page.evaluate(() => localStorage.setItem('td-color-theme', 'light'));
      await page.reload();
      assert.equal(await page.evaluate(()=>document.documentElement.dataset.bsTheme),'light','Stored light theme on reload');
      const toggle=page.locator('#praxis-theme-toggle');
      const box=await toggle.boundingBox();
      assert(box.x>=0 && box.x+box.width<=width+1,'Theme button fits the viewport');
      assert.equal(await page.locator('.td-light-dark-menu').count(),0,'Theme button has no dropdown');
      for (const theme of ['dark','light']) {
        await toggle.click();
        await page.waitForFunction(value=>document.documentElement.dataset.bsTheme===value,theme);
        assert.equal(await toggle.getAttribute('aria-label'),`Switch to ${theme==='dark'?'light':'dark'} mode`,'Theme button names its next action');
        assert(await toggle.locator(theme==='dark'?'.praxis-theme-toggle__sun':'.praxis-theme-toggle__moon').isVisible(),'Theme icon changes shape');
      }
      await page.reload();
      assert.equal(await page.evaluate(()=>document.documentElement.dataset.bsTheme),'light','Theme choice persists after reload');
    }
    report.interactions.push('Theme button switches appearance, icon, and saved preference at five widths');
    await page.setViewportSize({width:1440,height:1000});
    await page.goto(base+'/');
    await page.keyboard.press('Control+k');
    await page.waitForSelector('dialog[open]');
    const searchDialog = page.locator('dialog[open]').first();
    const input = searchDialog.locator('input[type="search"]');
    await input.fill('configuration');
    await input.press('Enter');
    await page.waitForTimeout(700);
    await searchDialog.locator('[data-praxis-results] li a').first().waitFor();
    assert(await searchDialog.locator('[data-praxis-results] li a').count()>0,'Search has no results');
    const shown=await searchDialog.locator('[data-praxis-results] li').count();
    if(await searchDialog.locator('[data-praxis-more]').isVisible()){
      await searchDialog.locator('[data-praxis-more]').click();
      assert(await searchDialog.locator('[data-praxis-results] li').count()>shown,'Show more search results');
    }
    await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
    const openSearchFindings=await page.evaluate(async()=> (await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map(x=>({id:x.id,impact:x.impact,nodes:x.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})));
    report.accessibility.push({name:'open-search',theme:await page.evaluate(()=>document.documentElement.dataset.bsTheme),width:1440,findings:openSearchFindings});
    await page.keyboard.press('Escape');
    await searchDialog.waitFor({state:'hidden'});
    assert.equal(await page.locator('dialog[open]').count(),0,'Escape must close search');
    await page.waitForFunction(()=>document.activeElement?.matches('.praxis-search-trigger'));
    assert.equal(await page.evaluate(()=>document.activeElement?.matches('.praxis-search-trigger')),true,'Search focus restore');
    report.interactions.push('Search shortcut, actual results, Escape and focus restore');

    await page.goto(base+find('praxis','v0.7.2','examples/configs/operations/hot-reload.yaml'));
    const rawExample=await context.request.get(base+'/praxis/v0.7.2/_assets/examples/configs/operations/hot-reload.yaml');
    assert.equal(rawExample.status(),200,'Example source download');
    const shownExample=(await page.locator('.highlight code').textContent()).trim();
    const downloadedExample=(await rawExample.text()).trim();
    assert(shownExample.includes('listeners:') && downloadedExample.includes(shownExample.split('\n')[0]),'Rendered excerpt and complete source download are available');
    assert((await page.locator('.docs-contribution-meta a').first().getAttribute('href')).endsWith('/examples/configs/operations/hot-reload.yaml'),'Example source action must target its upstream file');
    await page.locator('.docs-version-control select').selectOption({label:'v0.7.1'});
    await page.waitForURL('**/praxis/v0.7.1/examples/configs/operations/hot-reload.yaml/');
    report.interactions.push('Rendered examples match source downloads and preserve file across versions');

    await page.goto(base+find('praxis','v0.7.1','docs/quickstart.md'));
    await page.keyboard.press('Control+k');
    await page.waitForFunction(()=>document.querySelector('#praxis-search-dialog [data-praxis-version]').value==='v0.7.1');
    assert.equal(await page.locator('#praxis-search-dialog [data-praxis-product]').inputValue(),'praxis');
    await page.locator('#praxis-search-dialog [data-praxis-query]').fill('configuration');
    await page.locator('#praxis-search-dialog [data-praxis-query]').press('Enter');
    await page.locator('#praxis-search-dialog [data-praxis-results] li a').first().waitFor();
    const archiveLinks=await page.locator('#praxis-search-dialog [data-praxis-results] li a').evaluateAll(items=>items.map(x=>x.getAttribute('href')));
    assert(archiveLinks.every(x=>x==='/praxis/' || x.includes('/praxis/v0.7.1/')),'Archive search scope');
    await page.keyboard.press('Escape');
    report.interactions.push('Documentation search defaults to current product/version');

    await page.goto(base+'/search/?q=configuration&product=policy&version=v0.4.0&form=Reference');
    await page.locator('[data-praxis-search-mode="page"] [data-praxis-results] li a').first().waitFor();
    const resultBadges=await page.locator('[data-praxis-search-mode="page"] [data-praxis-results] li').allTextContents();
    assert(resultBadges.every(x=>x.includes('Reference') && x.includes('v0.4.0')),'Search form filter');
    report.interactions.push('Shareable search URL and documentation-form filtering');

    await page.goto(base+find('praxis','v0.7.2','docs/quickstart.md'));
    const selector=page.locator('.docs-version-control select');
    await selector.selectOption({label:'v0.7.1'});
    await page.waitForURL('**/praxis/v0.7.1/quickstart/');
    assert(await page.locator('.docs-version-banner').isVisible(),'Archive notice');
    report.interactions.push('Version switch preserves corresponding page and archive notice');

    await context.grantPermissions(['clipboard-read','clipboard-write']);
    const copy=page.locator('.td-click-to-copy').first();
    await copy.click();
    await page.waitForTimeout(50);
    assert((await page.evaluate(()=>navigator.clipboard.readText())).trim().length>0,'Code copy');
    report.interactions.push('Code copy to clipboard');

    await page.goto(base+find('praxis','v0.7.2','docs/architecture/overview.md'));
    await page.waitForSelector('.mermaid svg');
    await page.waitForFunction(()=>[...document.querySelectorAll('pre.mermaid')].every(node=>node.querySelector('svg')));
    const mermaidCount=await page.locator('.mermaid svg').count();
    assert(mermaidCount>0,'Mermaid diagrams rendered');
    await page.evaluate(()=>scrollTo(0,800));
    const y=await page.evaluate(()=>scrollY);
    await page.locator('#praxis-theme-toggle').click();
    assert.equal(await page.evaluate(()=>scrollY),y,'Theme change preserves scroll');
    assert.equal(await page.locator('.mermaid svg').count(),mermaidCount,'Theme preserves diagrams');
    await page.locator('.praxis-diagram-zoom').first().click();
    await page.locator('#praxis-diagram-dialog[open]').waitFor();
    assert(await page.locator('[data-praxis-diagram-canvas] svg').count()>0,'Enlarged Mermaid');
    await page.keyboard.press('Escape');
    await page.locator('#praxis-diagram-dialog').waitFor({state:'hidden'});
    report.interactions.push('Mermaid rendering, enlargement, theme/scroll preservation');

    await page.setViewportSize({width:320,height:844});
    await page.goto(base+'/');
    assert(await page.locator('.praxis-search-trigger').first().isVisible(),'Visible mobile search');
    assert(await page.locator('#praxis-theme-toggle').isVisible(),'Visible mobile appearance control');
    await page.locator('.praxis-navbar-toggle').click();
    await page.locator('#products-menu').click();
    await page.locator('.praxis-products-menu a[href="/praxis/v0.7.2/"]').click();
    await page.waitForURL('**/praxis/v0.7.2/');
    await page.goto(base+find('praxis','v0.7.2','docs/quickstart.md'));
    await page.locator('.td-sidebar__toggle').click();
    await page.locator('#td-section-nav').waitFor({state:'visible'});
    assert(await page.locator('.docs-sidebar-group').count()>=4,'Populated sidebar groups');
    await page.locator('.docs-mobile-toc summary').click();
    assert(await page.locator('.docs-mobile-toc[open]').isVisible(),'Mobile TOC');
    report.interactions.push('Mobile menu, visible search/appearance, docs drawer and TOC');

    const source=page.locator('.td-content .docs-contribution-meta a').filter({hasText:'View source'});
    assert(await source.isVisible(),'Source actions available on mobile');
    assert((await source.getAttribute('href')).includes('/blob/'),'Exact snapshot source');
    report.interactions.push('Mobile source actions');

    await page.goto(base+'/');
    await page.route('**/search-index/*',route=>route.abort());
    await page.locator('.praxis-search-trigger').first().click();
    await page.locator('#praxis-search-dialog [data-praxis-query]').fill('configuration');
    await page.locator('#praxis-search-dialog [data-praxis-query]').press('Enter');
    await page.locator('#praxis-search-dialog [data-praxis-status][data-state="error"]').waitFor();
    assert(await page.locator('#praxis-search-dialog [data-praxis-retry]').isVisible(),'Retry after unavailable index');
    await page.unroute('**/search-index/*');
    await page.locator('#praxis-search-dialog [data-praxis-retry]').click();
    await page.locator('#praxis-search-dialog [data-praxis-results] li a').first().waitFor();
    await page.locator('#praxis-search-dialog [data-praxis-query]').fill('zxqvnotfound');
    await page.locator('#praxis-search-dialog [data-praxis-query]').press('Enter');
    await page.locator('#praxis-search-dialog [data-praxis-status][data-state="empty"]').waitFor();
    assert.equal(await page.locator('#praxis-search-dialog [data-praxis-results] li').count(),0,'Empty result clears prior matches');
    await page.keyboard.press('Escape');
    report.interactions.push('Unavailable search, retry recovery, empty state, additional results');

    const fallback=sources.find(x=>x.product==='praxis' && x.version==='v0.7.2' && !sources.some(y=>y.product===x.product && y.version==='v0.5.3' && y.source_path===x.source_path));
    assert(fallback,'Representative missing historical counterpart');
    await page.goto(base+fallback.url);
    await page.locator('.docs-version-control select').selectOption('/praxis/v0.5.3/');
    await page.waitForURL('**/praxis/v0.5.3/?version_fallback=*');
    assert(await page.locator('.docs-version-fallback[role="status"]').isVisible(),'Version fallback explanation');
    report.interactions.push('Missing version counterpart opens overview with visible explanation');

    report.errors=errors;
    fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
    const violations=report.accessibility.flatMap(x=>x.findings);
    assert.equal(violations.length,0,`axe found ${violations.length} violations; see report.json`);
    assert.equal(errors.length,0,`Browser errors: ${errors.join('; ')}`);
    console.log(`Browser checks passed: ${report.matrix.length} responsive pages, ${report.accessibility.length} axe scans`);
  } finally {
    fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({...report,errors},null,2));
    await browser.close();
  }
})().catch(err=>{console.error(err);process.exitCode=1;});
