import puppeteer from 'puppeteer-core';
import { readFileSync, writeFileSync } from 'fs';
const MIN=parseFloat(process.argv[2]||'3');
const W=parseInt(process.argv[3]||'700'), H=parseInt(process.argv[4]||'525');
const out=process.argv[5]||'flatlay.png';
const fonts=readFileSync('fonts-embedded.css','utf8');
const bundle=readFileSync('flatlay.bundle.js','utf8');
writeFileSync('flat-page.html',`<!DOCTYPE html><html><head><meta charset="utf-8"><style>${fonts} body{margin:0;background:#000}</style></head>
<body><canvas id="c" width="${W}" height="${H}"></canvas>
<script>window.__W=${W};window.__H=${H};</script><script>${bundle}</script></body></html>`);
const browser=await puppeteer.launch({executablePath:'/root/.cache/puppeteer/chrome/linux-150.0.7871.24/chrome-linux64/chrome',headless:'new',
  args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist'],protocolTimeout:2*60*60*1000});
const page=await browser.newPage();
await page.goto(`file://${process.cwd()}/flat-page.html`,{timeout:120000});
const t0=Date.now();
while(true){
  await new Promise(r=>setTimeout(r,6000));
  const s=await page.evaluate(()=>({st:window.__status,err:window.__err,n:window.__samples||0}));
  const m=(Date.now()-t0)/60000;
  if(s.err){console.log('ERROR:',s.err.slice(0,500));break;}
  if(m>MIN){console.log(`done ${s.n.toFixed(0)} samples in ${m.toFixed(1)}min`);break;}
}
await page.screenshot({path:out,clip:{x:0,y:0,width:W,height:H}});
console.log('saved',out);
await browser.close();
