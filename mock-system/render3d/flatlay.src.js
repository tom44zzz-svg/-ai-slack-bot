import * as THREE from 'three';
import { WebGLPathTracer, PhysicalCamera } from 'three-gpu-pathtracer';

window.__status='init'; window.__err=null;
async function main(){
const W=window.__W||700, H=window.__H||525;
const canvas=document.getElementById('c');
const renderer=new THREE.WebGLRenderer({canvas,antialias:false,preserveDrawingBuffer:true});
renderer.setSize(W,H,false);
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.12;
const scene=new THREE.Scene();

// env
{
  const w=64,h=32,data=new Float32Array(w*h*4);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const t=y/(h-1);const top=[1,.97,.9],hor=[.6,.56,.5],bot=[.15,.13,.11];
    let c;if(t<.5){const u=t/.5;c=top.map((v,i)=>v*(1-u)+hor[i]*u);}else{const u=(t-.5)/.5;c=hor.map((v,i)=>v*(1-u)+bot[i]*u);}
    const i=(y*w+x)*4;data[i]=c[0]*.45;data[i+1]=c[1]*.45;data[i+2]=c[2]*.45;data[i+3]=1;
  }
  const tex=new THREE.DataTexture(data,w,h,THREE.RGBAFormat,THREE.FloatType);
  tex.mapping=THREE.EquirectangularReflectionMapping;tex.needsUpdate=true;
  scene.environment=tex;
}

// fonts
window.__status='font';
await document.fonts.load("700 100px 'SM'","灯り屋");
await document.fonts.load("500 40px 'SM'","YONEZAWA0123456789");

// ===== ブランド描画関数（単位: px/任意、CTMで拡縮） =====
const INK='#262019', CREAM='#f1ece0', GOLD='#8f6a2e';
function drawEmblem(ctx, R, color){  // 中心(0,0) 半径R
  ctx.strokeStyle=color; ctx.fillStyle=color;
  ctx.lineWidth=R*.07;
  ctx.beginPath(); ctx.arc(0,0,R,0,Math.PI*2); ctx.stroke();
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.font=`700 ${R*0.98}px 'SM'`;
  ctx.fillText('灯', 0, -R*.08);
  ctx.fillRect(-R*.3, R*.52, R*.6, R*.05);
}
function drawWordmark(ctx, s, color, sub){ // sは文字サイズ, 中心(0,0)
  ctx.fillStyle=color; ctx.textBaseline='middle';
  ctx.font=`700 ${s}px 'SM'`; ctx.textAlign='center';
  const pitch=s*1.55;
  ['灯','り','屋'].forEach((ch,i)=>ctx.fillText(ch,(i-1)*pitch,0));
  if(sub){
    ctx.font=`500 ${s*.24}px 'SM'`; ctx.textAlign='left';
    const t='YONEZAWA — AKARIYA'; const sp=s*.06;
    const ws=[...t].map(c=>ctx.measureText(c).width);
    let x=-(ws.reduce((a,b)=>a+b,0)+sp*(t.length-1))/2;
    [...t].forEach((c,i)=>{ctx.fillText(c,x,s*1.05);x+=ws[i]+sp;});
  }
}
function mkTex(w,h,draw){
  const c=document.createElement('canvas');c.width=w;c.height=h;
  const x=c.getContext('2d'); draw(x,c);
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=8;
  return t;
}

// ===== 素材 =====
const fabric=new THREE.MeshPhysicalMaterial({color:0x423a30,roughness:.92});
const table=new THREE.Mesh(new THREE.PlaneGeometry(300,300),
  new THREE.MeshPhysicalMaterial({color:0xb9ad9b,roughness:.85}));
table.rotation.x=-Math.PI/2;scene.add(table);

// ===== エプロン =====
{
  const sh=new THREE.Shape();
  sh.moveTo(-9.5,0);sh.lineTo(9.5,0);sh.lineTo(9.5,11);sh.lineTo(4.3,18);sh.lineTo(-4.3,18);sh.lineTo(-9.5,11);sh.closePath();
  const geo=new THREE.ExtrudeGeometry(sh,{depth:.5,bevelEnabled:false});
  const apron=new THREE.Mesh(geo,fabric);
  const grp=new THREE.Group();
  apron.rotation.x=-Math.PI/2; apron.position.y=0; grp.add(apron);
  // 首ひも（フラットに置かれたループ）
  const neck=new THREE.CatmullRomCurve3([new THREE.Vector3(-3.8,0.3,-18),new THREE.Vector3(0,0.3,-21.5),new THREE.Vector3(3.8,0.3,-18)]);
  grp.add(new THREE.Mesh(new THREE.TubeGeometry(neck,32,.35,12,false),fabric));
  // 腰ひも
  const t1=new THREE.CatmullRomCurve3([new THREE.Vector3(9.4,0.3,-11),new THREE.Vector3(13.5,0.3,-9),new THREE.Vector3(15.5,0.3,-5.5)]);
  const t2=new THREE.CatmullRomCurve3([new THREE.Vector3(-9.4,0.3,-11),new THREE.Vector3(-12.5,0.3,-8.5),new THREE.Vector3(-13.5,0.3,-5)]);
  grp.add(new THREE.Mesh(new THREE.TubeGeometry(t1,24,.35,12,false),fabric));
  grp.add(new THREE.Mesh(new THREE.TubeGeometry(t2,24,.35,12,false),fabric));
  // ポケット
  const pk=new THREE.Mesh(new THREE.BoxGeometry(8,.18,5.5),fabric);
  pk.position.set(0,.59,-5.5);grp.add(pk);
  // 胸エンブレム（クリーム印刷）
  const emTex=mkTex(512,512,(x)=>{x.translate(256,256);drawEmblem(x,200,CREAM);});
  const em=new THREE.Mesh(new THREE.CircleGeometry(2.2,48),
    new THREE.MeshPhysicalMaterial({map:emTex,alphaTest:.5,roughness:.85}));
  em.rotation.x=-Math.PI/2; em.position.set(0,.53,-14.6); grp.add(em);
  grp.scale.set(.82,1,.82); grp.position.set(-12,0,6); grp.rotation.y=.12; scene.add(grp);
}

// ===== キャップ =====
{
  const pts=[];const P=(r,y)=>pts.push(new THREE.Vector2(r,y));
  P(0,3.6);P(2.2,3.4);P(4.0,2.6);P(5.1,1.4);P(5.45,.4);P(5.45,0);
  const dome=new THREE.Mesh(new THREE.LatheGeometry(pts,64),fabric);
  const grp=new THREE.Group(); grp.add(dome);
  const btn=new THREE.Mesh(new THREE.SphereGeometry(.4,16,16),fabric);
  btn.position.y=3.6;grp.add(btn);
  // つば
  const sh=new THREE.Shape();
  sh.moveTo(-5.2,0); sh.quadraticCurveTo(-5.6,3.4,-3.4,5.2); sh.quadraticCurveTo(0,7,3.4,5.2); sh.quadraticCurveTo(5.6,3.4,5.2,0); sh.closePath();
  const brim=new THREE.Mesh(new THREE.ExtrudeGeometry(sh,{depth:.32,bevelEnabled:false}),fabric);
  brim.rotation.x=Math.PI/2; brim.position.y=.66; grp.add(brim);
  // 正面エンブレム
  const emTex=mkTex(512,512,(x)=>{x.translate(256,256);drawEmblem(x,200,CREAM);});
  const em=new THREE.Mesh(new THREE.CircleGeometry(1.5,48),
    new THREE.MeshPhysicalMaterial({map:emTex,alphaTest:.5,roughness:.85}));
  em.position.set(0,1.7,4.62); em.rotation.x=-.62; grp.add(em);
  grp.position.set(0,0,-10); grp.rotation.y=-.15; scene.add(grp);
}

// ===== マグ（ロゴ焼き込み・既存設計） =====
{
  const pts=[];const P=(r,y)=>pts.push(new THREE.Vector2(r,y));
  P(0,.18);P(1.6,.18);P(2.9,.22);P(3.55,.38);P(3.95,.75);P(4.12,1.4);P(4.2,2.4);
  P(4.22,4.47);P(4.22,6.53);P(4.2,8.6);P(4.18,9.15);P(4.12,9.42);P(3.98,9.5);
  P(3.84,9.42);P(3.8,9.1);P(3.78,8.2);P(3.76,5);P(3.7,2.2);P(3.3,1.35);P(2.4,1.1);P(0,1.05);
  const bodyTex=mkTex(4096,4096,(x)=>{
    x.fillStyle=CREAM;x.fillRect(0,0,4096,4096);
    x.setTransform(15.43,0,0,9.91,2048,2585);
    x.fillStyle=INK; drawWordmark(x,10.14,INK,true);
  });
  const bodyMat=new THREE.MeshPhysicalMaterial({map:bodyTex,roughness:.36,clearcoat:.55,clearcoatRoughness:.28});
  const ceramic=new THREE.MeshPhysicalMaterial({color:0xf1ece0,roughness:.36,clearcoat:.55,clearcoatRoughness:.28});
  const mug=new THREE.Mesh(new THREE.LatheGeometry(pts,128,-Math.PI,Math.PI*2),bodyMat);
  const hp=[new THREE.Vector3(3.8,6.75,0),new THREE.Vector3(6.55,6.25,0),new THREE.Vector3(6.55,3.85,0),new THREE.Vector3(3.85,3.3,0)];
  const handle=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hp,false,'catmullrom',.6),120,.5,28,false),ceramic);
  const g=new THREE.Group();g.add(mug);g.add(handle);
  g.position.set(5,0,1); g.rotation.y=.1; scene.add(g);  // 取っ手右上・ロゴをカメラへ
}

// ===== タンブラー（横置き・エンブレム上向き） =====
{
  const pts=[];const P=(r,y)=>pts.push(new THREE.Vector2(r,y));
  P(0,.2);P(2.95,.2);P(3.05,.6);P(3.1,4);P(3.25,8);P(3.4,12);P(3.52,15.5);P(3.45,15.85);P(3.3,15.8);P(3.26,15.2);P(0,15);
  const tex=mkTex(2048,2048,(x)=>{
    x.fillStyle='#23211f';x.fillRect(0,0,2048,2048);
    x.setTransform(9.89,0,0,5.34,1024,1194);
    drawEmblem(x,22,CREAM);
  });
  const mat=new THREE.MeshPhysicalMaterial({map:tex,metalness:.85,roughness:.38});
  const tb=new THREE.Mesh(new THREE.LatheGeometry(pts,96,-Math.PI,Math.PI*2),mat);
  tb.rotation.x=-Math.PI/2; tb.position.set(17,3.3,11); tb.rotation.z=.1;
  scene.add(tb);
}

// ===== 名刺（束+1枚） =====
{
  const cardTex=mkTex(1024,640,(x)=>{
    x.fillStyle='#f4efe4';x.fillRect(0,0,1024,640);
    x.save();x.translate(200,150);drawWordmark(x,64,INK,false);x.restore();
    x.fillStyle=INK;x.textAlign='left';x.textBaseline='alphabetic';
    x.font="500 44px 'SM'";x.fillText('AKARI YONEZAWA',96,360);
    x.font="500 26px 'SM'";x.fillStyle='#6b6156';
    x.fillText('0238-00-0000',96,470);
    x.fillText('akariya-yonezawa.jp',96,520);
    x.save();x.translate(880,470);drawEmblem(x,80,GOLD);x.restore();
  });
  const mat=new THREE.MeshPhysicalMaterial({map:cardTex,roughness:.65});
  const stack=new THREE.Mesh(new THREE.BoxGeometry(9.1,.6,5.5),mat);
  stack.position.set(-2.5,.3,11);stack.rotation.y=.14;scene.add(stack);
  const one=new THREE.Mesh(new THREE.BoxGeometry(9.1,.1,5.5),mat);
  one.position.set(-7.5,.05,15.5);one.rotation.y=-.32;scene.add(one);
}

// ===== チラシ（A6） =====
{
  const tex=mkTex(1024,1448,(x)=>{
    x.fillStyle='#f4efe4';x.fillRect(0,0,1024,1448);
    x.save();x.translate(512,190);drawEmblem(x,110,INK);x.restore();
    x.save();x.translate(512,470);drawWordmark(x,110,INK,true);x.restore();
    // 写真ブロック（暖色グラデ+玉ボケ）
    const g=x.createLinearGradient(0,640,0,1060);
    g.addColorStop(0,'#3d2f22');g.addColorStop(1,'#1f1710');
    x.fillStyle=g;x.fillRect(96,640,832,420);
    x.fillStyle='rgba(255,205,140,.8)';
    for(const [bx,by,r] of [[300,760,26],[520,820,18],[700,730,32],[820,880,14]]){x.beginPath();x.arc(bx,by,r,0,7);x.fill();}
    x.fillStyle='#f1ece0';x.textAlign='center';x.font="700 54px 'SM'";
    x.fillText('静けさを、贅沢に。',512,980);
    // フェイク本文（バー）
    x.fillStyle='#c9c0b2';
    for(let i=0;i<4;i++)x.fillRect(150,1120+i*46,724-(i%2)*160,16);
    x.fillStyle='#6b6156';x.font="500 30px 'SM'";
    x.fillText('YONEZAWA — AKARIYA',512,1370);
  });
  const fl=new THREE.Mesh(new THREE.BoxGeometry(10.4,.08,14.7),
    new THREE.MeshPhysicalMaterial({map:tex,roughness:.7}));
  fl.position.set(-15.5,.04,13);fl.rotation.y=.07;scene.add(fl);
}

// ===== キーホルダー（レザータグ+リング） =====
{
  const grp=new THREE.Group();
  const sh=new THREE.Shape();
  const w=1.6,h=3.2,r=.5;
  sh.moveTo(-w+r,-h);sh.lineTo(w-r,-h);sh.quadraticCurveTo(w,-h,w,-h+r);
  sh.lineTo(w,h-r);sh.quadraticCurveTo(w,h,w-r,h);sh.lineTo(-w+r,h);
  sh.quadraticCurveTo(-w,h,-w,h-r);sh.lineTo(-w,-h+r);sh.quadraticCurveTo(-w,-h,-w+r,-h);
  const tag=new THREE.Mesh(new THREE.ExtrudeGeometry(sh,{depth:.35,bevelEnabled:false}),
    new THREE.MeshPhysicalMaterial({color:0x7a4f2c,roughness:.55,clearcoat:.2}));
  tag.rotation.x=-Math.PI/2;tag.position.y=0;grp.add(tag);
  // 型押しエンブレム（濃色）
  const emTex=mkTex(512,512,(x)=>{x.translate(256,256);drawEmblem(x,200,'#54351d');});
  const em=new THREE.Mesh(new THREE.CircleGeometry(1.05,48),
    new THREE.MeshPhysicalMaterial({map:emTex,alphaTest:.5,roughness:.6}));
  em.rotation.x=-Math.PI/2;em.position.set(0,.37,.4);grp.add(em);
  // リング
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.9,.14,16,48),
    new THREE.MeshPhysicalMaterial({color:0xd8d2c8,metalness:1,roughness:.28}));
  ring.rotation.x=-Math.PI/2;ring.position.set(0,.2,-3.3);grp.add(ring);
  grp.position.set(4.5,0,17);grp.rotation.y=-.4;scene.add(grp);
}

// ===== 照明 =====
function softbox(w,h,c,i,p,t){
  const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),
    new THREE.MeshPhysicalMaterial({emissive:new THREE.Color(c),emissiveIntensity:i,color:0x000000}));
  m.position.set(...p);m.lookAt(...t);scene.add(m);
}
softbox(42,42,0xfff4e4,6.5,[-18,45,20],[0,0,2]);
softbox(30,30,0xe7ebf2,2.0,[20,36,-8],[0,0,0]);
softbox(8,30,0xffe3c0,2.5,[26,10,24],[0,2,0]);

// ===== カメラ =====
const cam=new PhysicalCamera(33,W/H,.1,400);
cam.position.set(0,52,32);cam.lookAt(0,0,4);
cam.focusDistance=59; cam.fStop=8; cam.updateProjectionMatrix();

window.__status='compile';
const pt=new WebGLPathTracer(renderer);
pt.bounces=5;pt.filterGlossyFactor=.5;pt.tiles.set(3,3);
pt.setScene(scene,cam);
window.__status='render';window.__samples=0;
(function loop(){pt.renderSample();window.__samples=pt.samples;requestAnimationFrame(loop);})();
}
main().catch(e=>{window.__err=String(e&&e.stack||e);window.__status='error';});
