// エッジ保存デノイザ（à-trous バイラテラル 3パス）
// 使い方: node denoise.mjs in.png out.png [強さ sigma=0.09]
import sharp from 'sharp';

const [inF, outF, sigmaArg] = process.argv.slice(2);
const SIGMA = parseFloat(sigmaArg || '0.09');   // 色距離の許容(0-1)。大=強くならす

const { data, info } = await sharp(inF).raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H, channels: C } = info;
let buf = Float32Array.from(data, v => v / 255);

const kernel = [1/16, 1/4, 3/8, 1/4, 1/16]; // B3スプライン
for (const step of [1, 2, 4]) {
  const out = new Float32Array(buf.length);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const ci = (y * W + x) * C;
      const cr = buf[ci], cg = buf[ci+1], cb = buf[ci+2];
      let wr = 0, ar = 0, ag = 0, ab = 0;
      for (let ky = -2; ky <= 2; ky++) {
        const yy = Math.min(H-1, Math.max(0, y + ky*step));
        for (let kx = -2; kx <= 2; kx++) {
          const xx = Math.min(W-1, Math.max(0, x + kx*step));
          const ni = (yy * W + xx) * C;
          const dr = buf[ni]-cr, dg = buf[ni+1]-cg, db = buf[ni+2]-cb;
          const dist2 = dr*dr + dg*dg + db*db;
          const w = kernel[ky+2] * kernel[kx+2] * Math.exp(-dist2 / (2*SIGMA*SIGMA));
          wr += w; ar += buf[ni]*w; ag += buf[ni+1]*w; ab += buf[ni+2]*w;
        }
      }
      out[ci] = ar/wr; out[ci+1] = ag/wr; out[ci+2] = ab/wr;
      if (C === 4) out[ci+3] = buf[ci+3];
    }
  }
  buf = out;
}
const outBytes = Buffer.from(Uint8Array.from(buf, v => Math.round(Math.min(1, Math.max(0, v)) * 255)));
await sharp(outBytes, { raw: { width: W, height: H, channels: C } }).png().toFile(outF);
console.log('denoised →', outF);
