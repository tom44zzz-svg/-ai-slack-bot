import * as THREE from 'three';
import { WebGLPathTracer, PhysicalCamera } from 'three-gpu-pathtracer';

window.__status='init'; window.__err=null;

// ============ シーン定義 ============
const SCENES = {
  // 朝のカフェ: 右窓からの暖光・木のテーブル・奥にカウンターのボケ
  cafe: {
    floor:{color:0x6b4f35, rough:0.42, cc:0.3}, wall:{color:0x7a6a54, z:-34},
    env:{top:[1,.93,.8], hor:[.5,.42,.33], bot:[.1,.08,.06], k:0.4},
    lights:[
      {w:22,h:26,c:0xffe3bd,i:11,p:[18,15,6],t:[0,5,0]},       // 窓光(右)
      {w:18,h:18,c:0xcfd8e4,i:1.1,p:[-15,10,14],t:[0,5,0]},    // 弱フィル
    ],
    props:(scene,M,EM)=>{
      // カウンター(奥の水平ボリューム) + 棚の瓶ボケ + 別のカップ
      scene.add(M(new THREE.BoxGeometry(60,10,6),0x4a3626,.6,[-6,5,-26]));
      scene.add(M(new THREE.CylinderGeometry(1.5,1.5,5,24),0x8a5a2e,.35,[-16,12.5,-25]));
      scene.add(M(new THREE.CylinderGeometry(1.2,1.2,4,24),0x3f6146,.35,[-24,12,-26]));
      scene.add(M(new THREE.CylinderGeometry(1.4,1.4,4.6,24),0xa8863f,.35,[-20.5,12.3,-25]));
      scene.add(M(new THREE.CylinderGeometry(3.4,2.9,7,32),0xe8e2d4,.4,[14,3.5,-14]));  // 別のカップ
      for(const [x,y] of [[-9,14],[-2,15.5],[6,13.5],[-14,12.5]])
        scene.add(EM(new THREE.SphereGeometry(.32,12,12),0xffd9a0,26,[x,y,-30]));      // 電球ボケ
    },
    cam:{fov:24,pos:[-6.5,8.8,33],look:[-0.5,5,0],fstop:2.0}
  },
  // 工場/工房: 高窓のクール光・コンクリ・金属の気配・パースを効かせた俯瞰
  factory: {
    floor:{color:0x6e6e6e, rough:0.7, cc:0.08}, wall:{color:0x8b8d8c, z:-40},
    env:{top:[.85,.9,1],hor:[.55,.58,.6],bot:[.14,.14,.15],k:0.5},
    lights:[
      {w:14,h:20,c:0xeef3fa,i:10,p:[-16,24,4],t:[0,5,0]},      // 高窓ハード寄りキー
      {w:24,h:14,c:0xffffff,i:1.6,p:[14,18,16],t:[0,5,0]},
    ],
    props:(scene,M,EM)=>{
      scene.add(M(new THREE.BoxGeometry(10,26,10),0x4c4f52,.45,[-22,13,-28]));          // 機械柱
      scene.add(M(new THREE.CylinderGeometry(4,4,30,32),0x5a5d60,.35,[16,15,-30]));     // ダクト
      scene.add(M(new THREE.BoxGeometry(26,3,8),0x3a3c3e,.5,[6,1.5,-20]));              // 作業台の影
      scene.add(M(new THREE.TorusGeometry(2.2,.5,16,48),0x9aa0a6,.3,[-10,2.2,-16],[Math.PI/2,0,0]));
    },
    cam:{fov:33,pos:[2,16,36],look:[0,4.5,0],fstop:4.5}
  },
  // オフィス: 白基調・天井光+デイライト・モニタと観葉植物のボケ
  office: {
    floor:{color:0xd9d5cd, rough:0.35, cc:0.25}, wall:{color:0xeceae4, z:-36},
    env:{top:[1,1,1],hor:[.8,.8,.82],bot:[.3,.3,.3],k:0.4},
    lights:[
      {w:30,h:30,c:0xffffff,i:4.5,p:[0,26,10],t:[0,5,0]},        // 天井面光
      {w:20,h:24,c:0xdfe9f4,i:3.2,p:[20,12,8],t:[0,5,0]},      // 窓デイライト
    ],
    props:(scene,M,EM)=>{
      scene.add(M(new THREE.BoxGeometry(16,9,.8),0x15181c,.25,[-13,9,-22],[0,.35,0]));       // モニタ
      scene.add(M(new THREE.BoxGeometry(2,5,2),0x8f959c,.4,[-13,3.5,-22]));             // スタンド
      scene.add(M(new THREE.SphereGeometry(2.0,24,24),0x39573f,.6,[15,9.5,-26]));        // 観葉植物(葉の塊)
      scene.add(M(new THREE.SphereGeometry(1.7,24,24),0x466e4c,.6,[17.5,8.2,-25.5]));
      scene.add(M(new THREE.SphereGeometry(1.5,24,24),0x314d38,.6,[14,7.6,-25]));
      scene.add(M(new THREE.CylinderGeometry(1.8,1.4,4,24),0xc9c3b6,.5,[16,3.5,-25.5]));
      scene.add(M(new THREE.BoxGeometry(9,.6,6),0xf2efe8,.4,[12,.3,-12]));              // 書類
    },
    cam:{fov:27,pos:[0,10.5,32],look:[0,4.8,0],fstop:2.2}
  },
  // 自宅の夜: ランプの暖低光・濃木・ストリングライトの大ボケ
  home: {
    floor:{color:0x3a2c20, rough:0.38, cc:0.35}, wall:{color:0x4a4038, z:-30},
    env:{top:[.6,.5,.4],hor:[.3,.24,.18],bot:[.08,.06,.05],k:0.35},
    lights:[
      {w:8,h:10,c:0xffd9a8,i:16,p:[13,11,7],t:[0,5,0]},        // ランプ(右・小さめ=柔らかドラマ)
      {w:16,h:16,c:0x7d8aa0,i:.7,p:[-14,9,12],t:[0,5,0]},      // 青みの弱フィル
      {w:14,h:12,c:0xffe2c2,i:1.0,p:[-10,7,18],t:[0,5,0]},     // 前からの微バウンス
    ],
    props:(scene,M,EM)=>{
      scene.add(M(new THREE.BoxGeometry(30,14,3),0x2e241b,.6,[-8,7,-24]));              // 本棚ボリューム
      scene.add(M(new THREE.BoxGeometry(2.2,6,2.2),0x6b4b2f,.5,[6,3,-13]));             // 木の小物
      for(const [x,y,z] of [[-15,8,-20],[-11,11,-22],[-7,8.5,-21],[-13,13,-24],[-4,12,-23],[9,12,-22],[12,9,-21]])
        scene.add(EM(new THREE.SphereGeometry(.3,12,12),0xffc98a,34,[x,y,z]));          // ストリングライト
    },
    cam:{fov:24,pos:[-3.5,7.5,34],look:[-0.5,4.8,0],fstop:1.8}
  },
};

async function main(){
const name = window.__scene || 'cafe';
const S = SCENES[name];
const W = window.__W || 1120, H = window.__H || 840;
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({canvas, antialias:false, preserveDrawingBuffer:true});
renderer.setSize(W,H,false);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
const scene = new THREE.Scene();

// env gradient
{
  const w=64,h=32,data=new Float32Array(w*h*4);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const t=y/(h-1); const {top,hor,bot,k}=S.env;
    let c; if(t<.5){const u=t/.5;c=top.map((v,i)=>v*(1-u)+hor[i]*u);}else{const u=(t-.5)/.5;c=hor.map((v,i)=>v*(1-u)+bot[i]*u);}
    const i=(y*w+x)*4; data[i]=c[0]*k;data[i+1]=c[1]*k;data[i+2]=c[2]*k;data[i+3]=1;
  }
  const tex=new THREE.DataTexture(data,w,h,THREE.RGBAFormat,THREE.FloatType);
  tex.mapping=THREE.EquirectangularReflectionMapping;tex.needsUpdate=true;
  scene.environment=tex;
}
// helpers
const M=(geo,color,rough,pos,rot)=>{const m=new THREE.Mesh(geo,new THREE.MeshPhysicalMaterial({color,roughness:rough}));m.position.set(...pos);if(rot)m.rotation.set(...rot);return m;};
const EM=(geo,color,i,pos)=>{const m=new THREE.Mesh(geo,new THREE.MeshPhysicalMaterial({color:0x000000,emissive:new THREE.Color(color),emissiveIntensity:i}));m.position.set(...pos);return m;};

// floor & wall
const floor=new THREE.Mesh(new THREE.PlaneGeometry(300,300),
  new THREE.MeshPhysicalMaterial({color:S.floor.color,roughness:S.floor.rough,clearcoat:S.floor.cc,clearcoatRoughness:.3}));
floor.rotation.x=-Math.PI/2;scene.add(floor);
const wall=new THREE.Mesh(new THREE.PlaneGeometry(300,160),
  new THREE.MeshPhysicalMaterial({color:S.wall.color,roughness:.95}));
wall.position.set(0,80,S.wall.z);scene.add(wall);

// ===== mug (共通) =====
const pts=[];const P=(r,y)=>pts.push(new THREE.Vector2(r,y));
P(0,.18);P(1.6,.18);P(2.9,.22);P(3.55,.38);P(3.95,.75);P(4.12,1.4);P(4.2,2.4);
P(4.22,4.47);P(4.22,6.53);P(4.2,8.6);P(4.18,9.15);P(4.12,9.42);P(3.98,9.5);
P(3.84,9.42);P(3.8,9.1);P(3.78,8.2);P(3.76,5);P(3.7,2.2);P(3.3,1.35);P(2.4,1.1);P(0,1.05);
const ceramic=new THREE.MeshPhysicalMaterial({color:0xf1ece0,roughness:.36,clearcoat:.55,clearcoatRoughness:.28});

// logo — ボディテクスチャに直接焼き込み（シームレス）
window.__status='font';
const cnv=document.createElement('canvas');cnv.width=4096;cnv.height=4096;
const ctx=cnv.getContext('2d');
await document.fonts.load("700 240px 'SM'","灯り屋");
await document.fonts.load("500 64px 'SM'","YONEZAWA");
ctx.fillStyle='#f1ece0';ctx.fillRect(0,0,4096,4096);   // 地色=陶器色
// UV写像: 外壁 y∈[2.4,8.6] ↔ v∈[0.30,0.45]（プロファイル等間隔化済みで線形）
// 水平: 全周26.55cm↔4096px=154.3px/cm ／ 垂直: 6.2cm↔614.4px=99.1px/cm
// ロゴ主文字の物理中心 y=5.25cm → v=0.3689 → canvas y=(1-v)*4096=2585
ctx.textAlign='center';ctx.textBaseline='middle';
ctx.setTransform(15.43,0,0,9.91,2048,2585);            // 単位=mm
ctx.fillStyle='#262019';
ctx.font="700 10.14px 'SM'";
for(let i=0;i<3;i++) ctx.fillText(['灯','り','屋'][i],(i-1)*15.9,0);
ctx.font="500 2.49px 'SM'";ctx.fillStyle='#8f6a2e';ctx.textAlign='left';
const sub='YONEZAWA — AKARIYA';const sp2=0.6;
const ws=[...sub].map(c=>ctx.measureText(c).width);
let sx=-(ws.reduce((a,b)=>a+b,0)+sp2*(sub.length-1))/2;
[...sub].forEach((c,i)=>{ctx.fillText(c,sx,11.6);sx+=ws[i]+sp2;});
ctx.setTransform(1,0,0,1,0,0);
const bodyTex=new THREE.CanvasTexture(cnv);bodyTex.colorSpace=THREE.SRGBColorSpace;bodyTex.anisotropy=8;
const bodyMat=new THREE.MeshPhysicalMaterial({map:bodyTex,color:0xffffff,roughness:.36,clearcoat:.55,clearcoatRoughness:.28});

const mug=new THREE.Mesh(new THREE.LatheGeometry(pts,128,-Math.PI,Math.PI*2), bodyMat);
const hpts=[new THREE.Vector3(3.8,6.75,0),new THREE.Vector3(6.55,6.25,0),new THREE.Vector3(6.55,3.85,0),new THREE.Vector3(3.85,3.3,0)];
const handle=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hpts,false,'catmullrom',.6),160,.5,36,false),ceramic);
const g=new THREE.Group();g.add(mug);g.add(handle);g.rotation.y=0.12;scene.add(g);

// lights
for(const L of S.lights){
  const m=new THREE.Mesh(new THREE.PlaneGeometry(L.w,L.h),
    new THREE.MeshPhysicalMaterial({emissive:new THREE.Color(L.c),emissiveIntensity:L.i,color:0x000000}));
  m.position.set(...L.p);m.lookAt(...L.t);scene.add(m);
}
// props
S.props(scene,M,EM);

// camera
const cam=new PhysicalCamera(S.cam.fov,W/H,.1,400);
cam.position.set(...S.cam.pos);cam.lookAt(...S.cam.look);
const d=new THREE.Vector3(...S.cam.pos).distanceTo(new THREE.Vector3(...S.cam.look));
cam.focusDistance=d; cam.fStop=S.cam.fstop; cam.updateProjectionMatrix();

window.__status='compile';
const pt=new WebGLPathTracer(renderer);
pt.bounces=5;pt.filterGlossyFactor=.5;pt.tiles.set(3,3);
pt.setScene(scene,cam);
window.__status='render';window.__samples=0;
(function loop(){pt.renderSample();window.__samples=pt.samples;requestAnimationFrame(loop);})();
}
main().catch(e=>{window.__err=String(e&&e.stack||e);window.__status='error';});
