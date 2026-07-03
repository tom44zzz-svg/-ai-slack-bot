import puppeteer from 'puppeteer-core';
import { readFileSync, writeFileSync } from 'fs';

const W = 1280, H = 960;
const MAX_MIN = parseFloat(process.argv[2] || '11');
const fonts = readFileSync('fonts-embedded.css','utf8');
const bundle = readFileSync('scene.bundle.js','utf8');
const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>${fonts} body{margin:0;background:#000} canvas{display:block}</style>
</head><body><canvas id="c" width="${W}" height="${H}"></canvas>
<script>window.__W=${W};window.__H=${H};</script>
<script>${bundle}</script></body></html>`;
writeFileSync('pt-page.html', html);

const browser = await puppeteer.launch({executablePath:'/root/.cache/puppeteer/chrome/linux-150.0.7871.24/chrome-linux64/chrome',headless:'new',
  args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist'],
  protocolTimeout: 20*60*1000});
const page = await browser.newPage();
page.on('console', m=>console.log('[page]', m.text().slice(0,200)));
await page.goto('file://'+process.cwd()+'/pt-page.html', {timeout:120000});

const t0 = Date.now();
let lastShot = 0;
while (true) {
  await new Promise(r=>setTimeout(r,5000));
  const s = await page.evaluate(()=>({status:window.__status, err:window.__err, samples:window.__samples||0}));
  const mins = (Date.now()-t0)/60000;
  console.log(`t=${mins.toFixed(1)}min status=${s.status} samples=${s.samples}`);
  if (s.err) { console.log('ERROR:', s.err.slice(0,600)); break; }
  if (mins - lastShot > 1.5 && s.samples > 2) {
    await page.screenshot({path:'pt-progress.png', clip:{x:0,y:0,width:W,height:H}});
    lastShot = mins;
  }
  if (mins > MAX_MIN || s.samples >= 450) break;
}
await page.screenshot({path:'mug-pt.png', clip:{x:0,y:0,width:W,height:H}});
console.log('saved mug-pt.png');
await browser.close();
