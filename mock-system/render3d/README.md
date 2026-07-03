# render3d — フォトリアル・プロダクトモック（パストレーシング）

ブランドロゴ入りプロダクト（マグ等）を**物理ベースレンダリング**で実写級に描く。
`/brand-mock <ブリーフ> product` の本命エンジン（SVG版 `templates/product-mock-mug.html` は高速ドラフト用）。

## 仕組み

```
ブランドトークン（SPEC §2-3）
  → scene.src.js に反映（陶器色 / インク色 / ロゴ文字 / 背景・照明のトーン）
  → esbuild でバンドル → ヘッドレスChrome(WebGL2/SwiftShader) で three-gpu-pathtracer 実行
  → 光の物理計算（GI・ソフトシャドウ・映り込み）を数百サンプル蓄積 → PNG
```

## 実行手順

```bash
npm i three three-gpu-pathtracer esbuild puppeteer-core sharp
# 1. ロゴ文字のフォントサブセットを base64 埋め込み（fonts-embedded.css を生成）
#    ※ロゴ文字を変えたら必ず再生成（Google Fonts CSS→該当unicode-rangeのwoff2をDL→@font-face化）
# 2. バンドル
npx esbuild scene.src.js --bundle --format=iife --outfile=scene.bundle.js
# 3. レンダリング（分数を指定。ソフトGPUで約5サンプル/分 @1280x960）
node pt-run.mjs 50
# 4. 仕上げ（1.5xアップスケール+微シャープ）
#    sharp: resize(1920,1440,lanczos3) + sharpen(sigma:0.8)
```

## 品質の勘所（変更時に守ること）

- **光源は物理配置**: キー(左上・大型ソフトボックス) / フィル(右・弱) / リム(右奥・フレーム外) / ウォールウォッシュ。
  発光パネルがカメラに写り込まない位置に置く（写り込むと合成っぽさが出る）
- **ロゴは alphaTest カットアウト**でボディに密着させる（透明平面を重ねると「ステッカー浮き」する）
- **サンプル数**: 130〜300で写真グレード。残る微ノイズはフィルム粒子として機能する
- **カメラ**: fov 28 / やや俯瞰（口がわずかに見える高さ）が商品撮影の定石
- 陶器: MeshPhysicalMaterial roughness≈0.36 + clearcoat≈0.55（釉薬）

## 既知の制約

- SwiftShader（ソフトGPU）のため遅い: 1280x960で約5サンプル/分 → 実用は30〜60分/枚
- 日本語ロゴはフォントサブセット埋め込みが必須（Google Fonts直リンクは描画タイミングで失敗する）
