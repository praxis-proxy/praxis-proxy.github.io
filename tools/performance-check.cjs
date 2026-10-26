/* Isolated playwright@1.58.2; a repeatable local mobile profile, not field data. */
const {chromium}=require('playwright');
const fs=require('node:fs');
const base=process.env.QA_BASE_URL || 'http://127.0.0.1:18131';
const out=process.env.QA_OUTPUT || '/tmp/praxis-redesign-qa';
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.QA_BROWSER_PATH || '/usr/bin/google-chrome',args:['--no-sandbox']});
  const results=[];
  try {
    for(let i=0;i<3;i++){
      const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true});
      const page=await context.newPage();
      let cssEncoding;
      page.on('response',response=>{if(response.url().includes('/scss/')) cssEncoding=response.headers()['content-encoding'] || 'identity';});
      const cdp=await context.newCDPSession(page);
      await cdp.send('Network.enable');
      await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
      await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:200000,uploadThroughput:93750});
      await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
      await page.addInitScript(()=>{
        window.qaVitals={lcp:0,cls:0};
        new PerformanceObserver(list=>{for(const e of list.getEntries()) {window.qaVitals.lcp=e.startTime;window.qaVitals.lcpElement=e.element?.tagName;}}).observe({type:'largest-contentful-paint',buffered:true});
        new PerformanceObserver(list=>{for(const e of list.getEntries()) if(!e.hadRecentInput) window.qaVitals.cls+=e.value;}).observe({type:'layout-shift',buffered:true});
      });
      await page.goto(base+'/',{waitUntil:'networkidle'});
      await page.evaluate(()=>document.fonts.ready);
      await page.waitForTimeout(1000);
      results.push({...await page.evaluate(()=>({...window.qaVitals,resources:performance.getEntriesByType('resource').length})),cssEncoding});
      await context.close();
    }
    fs.mkdirSync(out,{recursive:true});
    const report={profile:{width:390,height:844,cpuRate:4,latencyMs:150,downloadBytesPerSecond:200000,cache:'disabled',runs:3},results};
    fs.writeFileSync(out+'/performance.json',JSON.stringify(report,null,2));
    console.log(JSON.stringify(report));
  }finally{await browser.close();}
})().catch(err=>{console.error(err);process.exitCode=1;});
