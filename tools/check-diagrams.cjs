/* Focused SVG geometry regression. Use the same isolated Playwright as browser-check.cjs. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.QA_BASE_URL || 'http://localhost:1313';
const output = path.resolve(__dirname, '../output/playwright');

async function geometry(page) {
  return page.locator('svg').evaluateAll(svgs => svgs.flatMap(svg => {
    const bounds = element => {
      const b = element.getBBox(), m = element.getCTM();
      const p = new DOMPoint(b.x, b.y).matrixTransform(m);
      const q = new DOMPoint(b.x + b.width, b.y + b.height).matrixTransform(m);
      return {x:p.x, y:p.y, right:q.x, bottom:q.y, area:(q.x-p.x)*(q.y-p.y)};
    };
    const canvas = svg.getBoundingClientRect();
    const boxes = [...svg.querySelectorAll('rect')].map(bounds)
      .filter(b => b.area < canvas.width * canvas.height * 0.8);
    const labels = [...svg.querySelectorAll('text')].flatMap(text => {
      const b = bounds(text);
      const anchor = new DOMPoint(parseFloat(text.getAttribute('x')) || 0,
        parseFloat(text.getAttribute('y')) || 0).matrixTransform(text.getCTM());
      const box = boxes.filter(r => anchor.x >= r.x && anchor.x <= r.right &&
        anchor.y >= r.y && anchor.y <= r.bottom).sort((a,c) => a.area-c.area)[0];
      if (!box) return [];
      const padding = 8 * Math.abs(text.getCTM().a);
      return b.x < box.x + padding || b.right > box.right - padding ||
        b.y < box.y + padding || b.bottom > box.bottom - padding
        ? [{type:'label padding',text:text.textContent.trim(), bounds:b, box}] : [];
    });
    const arrows = [...svg.querySelectorAll('path')]
      .filter(p=>!p.closest('defs') && getComputedStyle(p).markerEnd!=='none').flatMap(p=>{
        if ((p.getAttribute('d').match(/[Mm]/g)||[]).length > 1)
          return [{type:'connector with missing arrowheads',text:p.getAttribute('d')}];
        const end = p.getPointAtLength(p.getTotalLength()).matrixTransform(p.getCTM());
        const touches = boxes.some(b=>(end.x>=b.x-2 && end.x<=b.right+2 &&
          (Math.abs(end.y-b.y)<=2 || Math.abs(end.y-b.bottom)<=2)) ||
          (end.y>=b.y-2 && end.y<=b.bottom+2 &&
          (Math.abs(end.x-b.x)<=2 || Math.abs(end.x-b.right)<=2)));
        return touches ? [] : [{type:'arrow detached from box',text:p.getAttribute('d')}];
      });
    return [...labels,...arrows];
  }));
}

(async () => {
  fs.mkdirSync(output, {recursive:true});
  const browser = await chromium.launch({executablePath:'/usr/bin/google-chrome', args:['--no-sandbox']});
  const page = await browser.newPage({viewport:{width:1440,height:1000}});
  const failures = [];
  try {
    const images = new Set();
    for (const project of ['praxis','ai']) {
      const response = await page.goto(`${base}/visual-guides/${project}/`);
      assert.equal(response.status(), 200);
      assert(!(await page.locator('main').textContent()).includes('{{<'),`${project} renders literal shortcodes`);
      assert.equal(await page.locator('.guide-figure--flow').count(),project==='praxis'?4:1);
      for (const src of await page.locator('main img').evaluateAll(nodes => nodes.map(x=>x.src))) images.add(src);
      if (project === 'ai') {
        await page.locator('[data-flow-walkthrough]').evaluate(x=>x.open=true);
        await page.evaluate(()=>document.fonts.ready);
        failures.push(...(await geometry(page)).map(x=>({diagram:'AI walkthrough',...x})));
      }
      const first = page.locator('.guide-figure__scroll').first();
      for (const width of [320,390,768,1440]) {
        await page.setViewportSize({width,height:1000});
        assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${project}/${width} page overflow`);
        const frame = await first.evaluate(el=>({frame:el.clientWidth,content:el.scrollWidth,image:el.querySelector('img').getBoundingClientRect().width}));
        assert(frame.image>=1024,`${project}/${width} diagram shrinks to illegible labels`);
        if (width<1024) assert(frame.content>frame.frame,`${project}/${width} diagram must scroll inside its frame`);
      }
      await page.setViewportSize({width:390,height:844});
      await first.focus();
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(200);
      assert(await first.evaluate(el=>el.scrollLeft>0),`${project} diagram cannot scroll with keyboard`);
      await page.screenshot({path:path.join(output,`diagram-${project}-mobile.png`),fullPage:true});
    }
    for (const src of images) {
      await page.goto(src);
      await page.evaluate(()=>document.fonts.ready);
      failures.push(...(await geometry(page)).map(x=>({diagram:src,...x})));
    }
    fs.writeFileSync(path.join(output,'diagram-geometry.json'),JSON.stringify(failures,null,2));
    assert.equal(failures.length,0,JSON.stringify(failures.map(x=>({diagram:x.diagram,text:x.text})),null,2));
    console.log(`Diagram geometry passed: ${images.size} SVG images and the AI walkthrough.`);
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
