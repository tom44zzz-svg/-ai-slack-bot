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

## マルチシーン版（scene-multi.src.js + pt-multi.mjs）

背景・照明・画角のバリエーションを持つシーンセット。`node pt-multi.mjs cafe,factory,office,home 20` で順次レンダリング。

| シーン | 光 | 画角 | 被写界深度 |
|---|---|---|---|
| cafe | 右窓の朝光+電球ボケ | 望遠24mm・低め | f/2.0（浅い） |
| factory | 高窓のクール光 | 広角33mm・俯瞰 | f/4.5 |
| office | 天井光+デイライト | 標準27mm・目線 | f/2.2 |
| home | ランプの暖低光+玉ボケ | 望遠24mm・寄り | f/1.8（最浅） |

### 重要な知見（変更時に守ること）

- **ロゴは本体テクスチャに焼き込む**（デカール別メッシュは材質を揃えてもシームが出る）。
  UV写像: LatheGeometry の外壁プロファイル点を等間隔にし v をy比例化。
  全周 2πr ↔ テクスチャ幅、v帯 ↔ 高さで px/cm を計算し setTransform で描画（scene-multi.src.js のコメント参照）
- **背景の実在感は造形でなく「ボケ+光の色」で作る**。プロップは示唆的な単純形状で足りる
- 玉ボケ（小さな発光球）は f/2 以下でカメラに近いほど大きく写る。z -20〜-24 が適距離

## ブランド一式フラットレイ（flatlay.src.js + pt-flat.mjs + denoise.mjs）

7アイテム（エプロン/キャップ/マグ/タンブラー/名刺/チラシ/レザーキーホルダー）を
俯瞰1枚に収めるブランドボード。エンブレム/ワードマークは drawEmblem()/drawWordmark() で共通化。

```bash
node pt-flat.mjs 65 900 675 flatlay-raw.png   # 65分レンダ(約600サンプル)
node denoise.mjs flatlay-raw.png out.png 0.035 # エッジ保存デノイズ(最弱)
# → sharp で lanczos3 2xアップスケール + sharpen
```

### ノイズ運用の結論
- ザラつき=パストレーシングのモンテカルロノイズ。サンプル数の平方根に反比例
- **600サンプル+弱デノイズ(σ0.035)が品質と時間のスイートスポット**（65分@900x675）
- デノイズを強くすると小さいロゴ文字が溶ける。メディアン前処理は文字面には使わない
- 低解像度で長時間回して2xアップスケールする方が、高解像度短時間より低ノイズ
