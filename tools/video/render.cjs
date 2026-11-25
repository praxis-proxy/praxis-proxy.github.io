/* Render tools/video/intro.html to the homepage film.
 *
 * Run with NODE_PATH pointing to an isolated playwright@1.58.2 install (see
 * README "Browser checks") and ffmpeg on PATH:
 *
 *   node tools/video/render.cjs                 # full render into static/videos/
 *   node tools/video/render.cjs --stills 3,12.5 # PNG stills into output/video/
 *   node tools/video/render.cjs --fps 30 --out output/video   # quick draft
 *
 * The scene is a pure function of time, so each frame is seek(t) + screenshot.
 */
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };
const fps = Number(opt('fps', 60));
const outDir = path.resolve(root, opt('out', 'static/videos'));
const stills = opt('stills', null);
const name = 'praxis-intro';

function run(cmd, argv, input) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, argv, { stdio: [input ? 'pipe' : 'ignore', 'ignore', 'inherit'] });
    p.on('error', reject);
    p.on('close', code => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
    if (input) input(p.stdin);
  });
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await page.goto('file://' + path.join(__dirname, 'intro.html') + '?t=0');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState('networkidle');
  const duration = await page.evaluate(() => window.DURATION);

  if (stills) {
    const dir = path.resolve(root, 'output/video');
    fs.mkdirSync(dir, { recursive: true });
    for (const t of stills.split(',').map(Number)) {
      await page.evaluate(x => window.seek(x), t);
      await page.screenshot({ path: path.join(dir, `still-${t.toFixed(2)}.png`) });
    }
    await browser.close();
    console.log(`stills written to ${dir}`);
    return;
  }

  fs.mkdirSync(outDir, { recursive: true });
  const master = path.join(root, 'output/video', `${name}-master.mp4`);
  fs.mkdirSync(path.dirname(master), { recursive: true });
  const frames = Math.round(duration * fps);
  const started = Date.now();
  await run('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '10', '-pix_fmt', 'yuv420p', master], async stdin => {
    for (let f = 0; f < frames; f++) {
      await page.evaluate(x => window.seek(x), f / fps);
      const buf = await page.screenshot({ type: 'png' });
      if (!stdin.write(buf)) await new Promise(r => stdin.once('drain', r));
      if (f % (fps * 5) === 0) console.log(`frame ${f}/${frames} (${((Date.now() - started) / 1000).toFixed(0)}s)`);
    }
    stdin.end();
  });
  await browser.close();

  // Web deliverables: H.264 MP4 for reach, VP9 WebM for size, and a poster.
  const mp4 = path.join(outDir, `${name}.mp4`), webm = path.join(outDir, `${name}.webm`), poster = path.join(outDir, `${name}-poster.jpg`);
  await run('ffmpeg', ['-y', '-loglevel', 'error', '-i', master, '-c:v', 'libx264', '-preset', 'veryslow', '-crf', '24', '-tune', 'animation',
    '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', mp4]);
  await run('ffmpeg', ['-y', '-loglevel', 'error', '-i', master, '-c:v', 'libvpx-vp9', '-crf', '42', '-b:v', '0', '-row-mt', '1',
    '-deadline', 'good', '-cpu-used', '2', '-pix_fmt', 'yuv420p', '-an', webm]);
  await run('ffmpeg', ['-y', '-loglevel', 'error', '-ss', opt('poster', '7.8'), '-i', master, '-frames:v', '1', '-vf', 'scale=1280:-2', '-q:v', '4', poster]);
  for (const f of [mp4, webm, poster]) console.log(`${path.relative(root, f)}  ${(fs.statSync(f).size / 1048576).toFixed(2)} MB`);
})().catch(err => { console.error(err); process.exit(1); });
