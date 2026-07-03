// シネマティックグレード v2 — 全処理を純JSのrawパスで実行（合成バグ排除）
// filmicカーブ→スプリットトーン→ブルーム→ハレーション→色収差→周辺減光→粒子
// 使い方: node grade.mjs in.png out.png [目標幅=1800]
import sharp from 'sharp';

const [inF, outF, tw] = process.argv.slice(2);
const TW = parseInt(tw || '1800');

const { data, info } = await sharp(inF).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height;
const N = W * H;

// float配列へ（0-1）
const R = new Float32Array(N), G = new Float32Array(N), B = new Float32Array(N);
for (let i = 0; i < N; i++) { R[i]=data[i*3]/255; G[i]=data[i*3+1]/255; B[i]=data[i*3+2]/255; }

// ---- 1. filmicカーブ + スプリットトーン ----
const filmic = (x) => Math.min(1, Math.max(0, .03 + .97*Math.pow(x,1.06) * (1.25/(1+.25*Math.pow(x,2.2)))));
for (let i = 0; i < N; i++) {
  let r=filmic(R[i]), g=filmic(G[i]), b=filmic(B[i]);
  const luma = .299*r+.587*g+.114*b;
  const sh = Math.pow(1-luma,2)*.026, hi = Math.pow(luma,2)*.055;
  R[i]=r-sh*.6+hi; G[i]=g-sh*.1+hi*.55; B[i]=b+sh-hi*.5;
}

// ---- 2. ブルーム & ハレーション（閾値→ボックスブラー3回≒ガウス→加算） ----
function boxBlur(src, radius){                        // 分離ボックスブラー
  const tmp=new Float32Array(N), dst=new Float32Array(N);
  const w2=radius*2+1;
  for(let y=0;y<H;y++){                                // 横
    let acc=0; const row=y*W;
    for(let x=-radius;x<=radius;x++) acc+=src[row+Math.min(W-1,Math.max(0,x))];
    for(let x=0;x<W;x++){ tmp[row+x]=acc/w2;
      acc+=src[row+Math.min(W-1,x+radius+1)]-src[row+Math.max(0,x-radius)];}
  }
  for(let x=0;x<W;x++){                                // 縦
    let acc=0;
    for(let y=-radius;y<=radius;y++) acc+=tmp[Math.min(H-1,Math.max(0,y))*W+x];
    for(let y=0;y<H;y++){ dst[y*W+x]=acc/w2;
      acc+=tmp[Math.min(H-1,y+radius+1)*W+x]-tmp[Math.max(0,y-radius)*W+x];}
  }
  return dst;
}
const lum=new Float32Array(N);
for(let i=0;i<N;i++) lum[i]=.299*R[i]+.587*G[i]+.114*B[i];
const hiPass=new Float32Array(N);
for(let i=0;i<N;i++) hiPass[i]=Math.max(0,lum[i]-.72)*3;
let bloom=boxBlur(hiPass,4); bloom=boxBlur(bloom,4); bloom=boxBlur(bloom,4);
let halo=boxBlur(hiPass,14); halo=boxBlur(halo,14);
for(let i=0;i<N;i++){
  R[i]+=bloom[i]*.16 + halo[i]*.10;        // ハレーションは赤寄り
  G[i]+=bloom[i]*.14 + halo[i]*.055;
  B[i]+=bloom[i]*.12 + halo[i]*.03;
}

// ---- 3. 色収差（radial: RとBを逆向きに微サンプルシフト） ----
const cx=W/2, cy=H/2, maxR=Math.hypot(cx,cy);
const R2=new Float32Array(N), B2=new Float32Array(N);
const sample=(ch,x,y)=>{x=Math.min(W-1,Math.max(0,x));y=Math.min(H-1,Math.max(0,y));
  return ch[Math.round(y)*W+Math.round(x)];};
for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const dx=x-cx, dy=y-cy, d=(dx*dx+dy*dy)/(maxR*maxR);
  const k=1.8*d;                                        // 端で最大~1.8px
  R2[y*W+x]=sample(R, x+dx/maxR*k, y+dy/maxR*k);
  B2[y*W+x]=sample(B, x-dx/maxR*k, y-dy/maxR*k);
}

// ---- 4. 周辺減光 + 粒子 → 8bit ----
let seed=12345; const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
const out=Buffer.alloc(N*3);
for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const i=y*W+x;
  const d=Math.hypot(x-cx,y-cy)/maxR;
  const vig=1-.16*Math.pow(d,2.6);
  const lu=.299*R2[i]+.587*G[i]+.114*B2[i];
  const grain=(rnd()-.5)*.035*(1-Math.abs(lu-.45));
  out[i*3]  =Math.min(255,Math.max(0,(R2[i]*vig+grain)*255));
  out[i*3+1]=Math.min(255,Math.max(0,(G[i] *vig+grain)*255));
  out[i*3+2]=Math.min(255,Math.max(0,(B2[i]*vig+grain)*255));
}
await sharp(out,{raw:{width:W,height:H,channels:3}})
  .resize(TW,Math.round(TW*H/W),{kernel:'lanczos3'})
  .sharpen({sigma:.9,m1:.4,m2:.2})
  .png().toFile(outF);
console.log('graded →', outF);
