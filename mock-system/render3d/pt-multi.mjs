import puppeteer from 'puppeteer-core';
import { readFileSync, writeFileSync } from 'fs';

const scenes = (process.argv[2]||'cafe,factory,office,home').split(',');
const MIN = parseFloat(process.argv[3]||'4');
const W=1120,H=840;
const fonts=readFileSync('fonts-embedded.css','utf8');
const bundle=readFileSync('scene-multi.bundle.js','utf8');

const browser=await puppeteer.launch({executablePath:'/root/.cache/puppeteer/chrome/linux-150.0.7871.24/chrome-linux64/chrome',headless:'new',
  args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist'],
  protocolTimeout:60*60*1000});

for (const name of scenes){
  const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><style>${fonts} body{margin:0;background:#000}</style></head>
<body><canvas id="c" width="${W}" height="${H}"></canvas>
<script>window.__W=${W};window.__H=${H};window.__scene='${name}';</script>
<script>${bundle}</script></body></html>`;
  writeFileSync(`pt-${name}.html`,html);
  const page=await browser.newPage();
  await page.goto(`file://${process.cwd()}/pt-${name}.html`,{timeout:120000});
  const t0=Date.now();
  while(true){
    await new Promise(r=>setTimeout(r,6000));
    const s=await page.evaluate(()=>({st:window.__status,err:window.__err,n:window.__samples||0}));
    const m=(Date.now()-t0)/60000;
    if(s.err){console.log(`[${name}] ERROR:`,s.err.slice(0,400));break;}
    if(m>MIN){console.log(`[${name}] done ${s.n.toFixed(0)} samples`);break;}
  }
  await page.screenshot({path:`scene-${name}.png`,clip:{x:0,y:0,width:W,height:H}});
  await page.close();
  console.log(`[${name}] saved scene-${name}.png`);
}
await browser.close();
console.log('ALL DONE');
