import * as THREE from 'three';
import { WebGLPathTracer, PhysicalCamera } from 'three-gpu-pathtracer';

window.__status='init'; window.__err=null;
async function main(){
const W=window.__W||700, H=window.__H||525;
const canvas=document.getElementById('c');
const renderer=new THREE.WebGLRenderer({canvas,antialias:false,preserveDrawingBuffer:true});
renderer.setSize(W,H,false);
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.1;
const scene=new THREE.Scene();

// 薄暗い暖色env
{
  const w=64,h=32,data=new Float32Array(w*h*4);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const t=y/(h-1);const top=[.55,.45,.34],hor=[.28,.22,.16],bot=[.06,.05,.04];
    let c;if(t<.5){const u=t/.5;c=top.map((v,i)=>v*(1-u)+hor[i]*u);}else{const u=(t-.5)/.5;c=hor.map((v,i)=>v*(1-u)+bot[i]*u);}
    const i=(y*w+x)*4;data[i]=c[0]*.5;data[i+1]=c[1]*.5;data[i+2]=c[2]*.5;data[i+3]=1;
  }
  const tex=new THREE.DataTexture(data,w,h,THREE.RGBAFormat,THREE.FloatType);
  tex.mapping=THREE.EquirectangularReflectionMapping;tex.needsUpdate=true;
  scene.environment=tex;
}

window.__status='font';
await document.fonts.load("700 100px 'SM'","灯り屋");
await document.fonts.load("500 40px 'SM'","YONEZAWA0123456789");

const INK='#262019', CREAM='#f1ece0', GOLD='#8f6a2e';
function drawEmblem(ctx,R,color){
  ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=R*.07;
  ctx.beginPath();ctx.arc(0,0,R,0,Math.PI*2);ctx.stroke();
  ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.font=`700 ${R*0.98}px 'SM'`;ctx.fillText('灯',0,-R*.08);
  ctx.fillRect(-R*.3,R*.52,R*.6,R*.05);
}
function drawWordmark(ctx,s,color,sub){
  ctx.fillStyle=color;ctx.textBaseline='middle';
  ctx.font=`700 ${s}px 'SM'`;ctx.textAlign='center';
  const pitch=s*1.55;
  ['灯','り','屋'].forEach((ch,i)=>ctx.fillText(ch,(i-1)*pitch,0));
  if(sub){
    ctx.font=`500 ${s*.24}px 'SM'`;ctx.textAlign='left';
    const t='YONEZAWA — AKARIYA';const sp=s*.06;
    const ws=[...t].map(c=>ctx.measureText(c).width);
    let x=-(ws.reduce((a,b)=>a+b,0)+sp*(t.length-1))/2;
    [...t].forEach((c,i)=>{ctx.fillText(c,x,s*1.05);x+=ws[i]+sp;});
  }
}
function mkTex(w,h,draw){
  const c=document.createElement('canvas');c.width=w;c.height=h;
  const x=c.getContext('2d');draw(x,c);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;
}
const M=(geo,color,rough,pos,rot)=>{const m=new THREE.Mesh(geo,new THREE.MeshPhysicalMaterial({color,roughness:rough}));m.position.set(...pos);if(rot)m.rotation.set(...rot);return m;};
const EM=(geo,c,i,pos)=>{const m=new THREE.Mesh(geo,new THREE.MeshPhysicalMaterial({color:0x000000,emissive:new THREE.Color(c),emissiveIntensity:i}));m.position.set(...pos);return m;};

// ===== テーブル（無垢材の板目テクスチャ） =====
{
  const woodTex=mkTex(1024,1024,(x)=>{
    x.fillStyle='#5a4534';x.fillRect(0,0,1024,1024);
    for(let i=0;i<8;i++){
      const w=128;
      x.fillStyle=`rgba(${30+Math.sin(i*3.7)*14},${20+Math.sin(i*2.3)*9},${10},${.18+(i%3)*.05})`;
      x.fillRect(i*w,0,w,1024);
      x.fillStyle='rgba(20,12,6,.5)';x.fillRect(i*w,0,3,1024);
    }
    // 木目の筋
    x.strokeStyle='rgba(30,18,8,.25)';x.lineWidth=2;
    for(let i=0;i<30;i++){
      x.beginPath();const yy=Math.random()*1024;
      x.moveTo(0,yy);x.bezierCurveTo(300,yy+20,700,yy-25,1024,yy+10);x.stroke();
    }
  });
  woodTex.wrapS=woodTex.wrapT=THREE.RepeatWrapping;woodTex.repeat.set(2,2);
  const tbl=new THREE.Mesh(new THREE.PlaneGeometry(160,90),
    new THREE.MeshPhysicalMaterial({map:woodTex,roughness:.42,clearcoat:.35,clearcoatRoughness:.3}));
  tbl.rotation.x=-Math.PI/2;scene.add(tbl);
}
// ===== カフェ店内（背景・ボケ前提） =====
{
  const floor=M(new THREE.PlaneGeometry(400,300),0x2e241a,.8,[0,-28,-100]);
  floor.rotation.x=-Math.PI/2;scene.add(floor);
  scene.add(M(new THREE.PlaneGeometry(400,120),0x4a3a2c,.95,[0,30,-95]));            // 奥壁
  // カウンター+ボトル棚(左奥)
  scene.add(M(new THREE.BoxGeometry(70,26,14),0x3a2c1f,.6,[-45,-15,-70]));
  scene.add(M(new THREE.BoxGeometry(70,2.5,10),0x2c2117,.6,[-45,4,-72]));
  for(const [bx,bh,bc] of [[-62,9,0x7a5a2e],[-54,7,0x44614a],[-47,10,0x8a6a3a],[-38,6,0x5a4838],[-30,8,0x6e5540]])
    scene.add(M(new THREE.CylinderGeometry(1.7,1.7,bh,20),bc,.3,[bx,5.5+bh/2,-72]));
  // 窓(右奥・暖光)=メインキー
  const win=EM(new THREE.PlaneGeometry(46,52),0xffe2b6,6.5,[52,8,-62]);
  win.lookAt(0,4,0);scene.add(win);
  scene.add(M(new THREE.BoxGeometry(3,52,4),0x241a10,.8,[38,8,-58]));                // 窓枠
  // 吊り電球(ペンダント)
  for(const [px,py,pz] of [[-14,26,-48],[8,23,-44],[26,27,-52]]){
    scene.add(EM(new THREE.SphereGeometry(1.5,16,16),0xffc98a,20,[px,py,pz]));
    scene.add(M(new THREE.CylinderGeometry(.15,.15,20,8),0x1a130c,.8,[px,py+11,pz]));
  }
  // 遠くの丸テーブル+椅子の気配(右)
  scene.add(M(new THREE.CylinderGeometry(12,12,1.5,32),0x3f3022,.5,[30,-8,-72]));
  scene.add(M(new THREE.CylinderGeometry(1.2,1.2,18,12),0x2c2117,.6,[30,-18,-72]));
  // 観葉植物(左)
  scene.add(M(new THREE.SphereGeometry(6,20,20),0x2e4a34,.7,[-24,6,-58]));
  scene.add(M(new THREE.SphereGeometry(4.5,20,20),0x37573d,.7,[-19,11,-60]));
}

// ===== アイテム（実物スケール） =====
const fabric=new THREE.MeshPhysicalMaterial({color:0x423a30,roughness:.92});

// エプロン: 畳んだ状態 34x24cm・厚み1.6(2層で折り目表現)
{
  const grp=new THREE.Group();
  const rr=(w,h,r)=>{const s=new THREE.Shape();
    s.moveTo(-w+r,-h);s.lineTo(w-r,-h);s.quadraticCurveTo(w,-h,w,-h+r);
    s.lineTo(w,h-r);s.quadraticCurveTo(w,h,w-r,h);s.lineTo(-w+r,h);
    s.quadraticCurveTo(-w,h,-w,h-r);s.lineTo(-w,-h+r);s.quadraticCurveTo(-w,-h,-w+r,-h);return s;};
  const bottom=new THREE.Mesh(new THREE.ExtrudeGeometry(rr(17,12,2),{depth:.9,bevelEnabled:false}),fabric);
  bottom.rotation.x=-Math.PI/2;grp.add(bottom);
  const top=new THREE.Mesh(new THREE.ExtrudeGeometry(rr(16.2,10.8,2),{depth:.8,bevelEnabled:false}),fabric);
  top.rotation.x=-Math.PI/2;top.position.set(-.6,.9,.8);grp.add(top);
  const emTex=mkTex(512,512,(x)=>{x.translate(256,256);drawEmblem(x,200,CREAM);});
  const em=new THREE.Mesh(new THREE.CircleGeometry(3,48),
    new THREE.MeshPhysicalMaterial({map:emTex,alphaTest:.5,roughness:.85}));
  em.rotation.x=-Math.PI/2;em.position.set(-3,1.72,-3);grp.add(em);
  grp.position.set(-17,0,1);grp.rotation.y=.22;scene.add(grp);
}
// キャップ: 実寸 クラウンφ17.6
{
  const grp=new THREE.Group();
  const pts=[];const P=(r,y)=>pts.push(new THREE.Vector2(r,y));
  P(0,5.8);P(3.5,5.4);P(6.4,4.2);P(8.2,2.2);P(8.75,.6);P(8.75,0);
  grp.add(new THREE.Mesh(new THREE.LatheGeometry(pts,64),fabric));
  const btn=new THREE.Mesh(new THREE.SphereGeometry(.6,16,16),fabric);btn.position.y=5.8;grp.add(btn);
  const sh=new THREE.Shape();
  sh.moveTo(-8.3,0);sh.quadraticCurveTo(-8.9,5.4,-5.4,8.3);sh.quadraticCurveTo(0,11.2,5.4,8.3);sh.quadraticCurveTo(8.9,5.4,8.3,0);sh.closePath();
  const brim=new THREE.Mesh(new THREE.ExtrudeGeometry(sh,{depth:.5,bevelEnabled:false}),fabric);
  brim.rotation.x=Math.PI/2;brim.position.y=1.0;grp.add(brim);
  const emTex=mkTex(512,512,(x)=>{x.translate(256,256);drawEmblem(x,200,CREAM);});
  const em=new THREE.Mesh(new THREE.CircleGeometry(1.9,48),
    new THREE.MeshPhysicalMaterial({map:emTex,alphaTest:.5,roughness:.85}));
  em.position.set(0,2.6,7.9);em.rotation.x=-.42;grp.add(em);
  grp.position.set(14,0,-8);grp.rotation.y=.5;scene.add(grp);  // つば手前・エンブレム正面へ
}
// マグ（主役・ロゴ正面）
{
  const pts=[];const P=(r,y)=>pts.push(new THREE.Vector2(r,y));
  P(0,.18);P(1.6,.18);P(2.9,.22);P(3.55,.38);P(3.95,.75);P(4.12,1.4);P(4.2,2.4);
  P(4.22,4.47);P(4.22,6.53);P(4.2,8.6);P(4.18,9.15);P(4.12,9.42);P(3.98,9.5);
  P(3.84,9.42);P(3.8,9.1);P(3.78,8.2);P(3.76,5);P(3.7,2.2);P(3.3,1.35);P(2.4,1.1);P(0,1.05);
  const bodyTex=mkTex(4096,4096,(x)=>{
    x.fillStyle=CREAM;x.fillRect(0,0,4096,4096);
    x.setTransform(15.43,0,0,9.91,2048,2585);
    drawWordmark(x,10.14,INK,true);
  });
  const bodyMat=new THREE.MeshPhysicalMaterial({map:bodyTex,roughness:.36,clearcoat:.55,clearcoatRoughness:.28});
  const ceramic=new THREE.MeshPhysicalMaterial({color:0xf1ece0,roughness:.36,clearcoat:.55,clearcoatRoughness:.28});
  const mug=new THREE.Mesh(new THREE.LatheGeometry(pts,128,-Math.PI,Math.PI*2),bodyMat);
  const hp=[new THREE.Vector3(3.8,6.75,0),new THREE.Vector3(6.55,6.25,0),new THREE.Vector3(6.55,3.85,0),new THREE.Vector3(3.85,3.3,0)];
  const handle=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hp,false,'catmullrom',.6),120,.5,28,false),ceramic);
  const g=new THREE.Group();g.add(mug);g.add(handle);
  g.position.set(2,0,7);g.rotation.y=.35;scene.add(g);
}
// タンブラー（立てる・左奥）
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
  tb.position.set(-6,0,-4);tb.rotation.y=.1;scene.add(tb);
}
// 名刺（束+立てかけ1枚）
{
  const cardTex=mkTex(1024,640,(x)=>{
    x.fillStyle='#f4efe4';x.fillRect(0,0,1024,640);
    x.save();x.translate(200,150);drawWordmark(x,64,INK,false);x.restore();
    x.fillStyle=INK;x.textAlign='left';x.textBaseline='alphabetic';
    x.font="500 44px 'SM'";x.fillText('AKARI YONEZAWA',96,360);
    x.font="500 26px 'SM'";x.fillStyle='#6b6156';
    x.fillText('0238-00-0000',96,470);x.fillText('akariya-yonezawa.jp',96,520);
    x.save();x.translate(880,470);drawEmblem(x,80,GOLD);x.restore();
  });
  const mat=new THREE.MeshPhysicalMaterial({map:cardTex,roughness:.65});
  const stack=new THREE.Mesh(new THREE.BoxGeometry(9.1,.7,5.5),mat);
  stack.position.set(11.5,.35,10);stack.rotation.y=-.2;scene.add(stack);
  const lean=new THREE.Mesh(new THREE.BoxGeometry(9.1,.08,5.5),mat);
  lean.position.set(12.8,0.78,11.8);lean.rotation.y=.15;scene.add(lean);  // 束の上にずらし置き
}
// チラシ A5（左手前・角度）
{
  const tex=mkTex(1024,1448,(x)=>{
    x.fillStyle='#f4efe4';x.fillRect(0,0,1024,1448);
    x.save();x.translate(512,190);drawEmblem(x,110,INK);x.restore();
    x.save();x.translate(512,470);drawWordmark(x,110,INK,true);x.restore();
    const g=x.createLinearGradient(0,640,0,1060);
    g.addColorStop(0,'#3d2f22');g.addColorStop(1,'#1f1710');
    x.fillStyle=g;x.fillRect(96,640,832,420);
    x.fillStyle='rgba(255,205,140,.8)';
    for(const [bx,by,r] of [[300,760,26],[520,820,18],[700,730,32],[820,880,14]]){x.beginPath();x.arc(bx,by,r,0,7);x.fill();}
    x.fillStyle='#f1ece0';x.textAlign='center';x.font="700 54px 'SM'";
    x.fillText('静けさを、贅沢に。',512,980);
    x.fillStyle='#c9c0b2';
    for(let i=0;i<4;i++)x.fillRect(150,1120+i*46,724-(i%2)*160,16);
    x.fillStyle='#6b6156';x.font="500 30px 'SM'";x.textAlign='center';
    x.fillText('YONEZAWA — AKARIYA',512,1370);
  });
  const fl=new THREE.Mesh(new THREE.BoxGeometry(14.8,.08,21),
    new THREE.MeshPhysicalMaterial({map:tex,roughness:.7}));
  fl.position.set(-13,.04,17);fl.rotation.y=-.28;scene.add(fl);
}
// キーホルダー（マグ手前）
{
  const grp=new THREE.Group();
  const w=1.6,h=3.2,r=.5;const sh=new THREE.Shape();
  sh.moveTo(-w+r,-h);sh.lineTo(w-r,-h);sh.quadraticCurveTo(w,-h,w,-h+r);
  sh.lineTo(w,h-r);sh.quadraticCurveTo(w,h,w-r,h);sh.lineTo(-w+r,h);
  sh.quadraticCurveTo(-w,h,-w,h-r);sh.lineTo(-w,-h+r);sh.quadraticCurveTo(-w,-h,-w+r,-h);
  const tag=new THREE.Mesh(new THREE.ExtrudeGeometry(sh,{depth:.35,bevelEnabled:false}),
    new THREE.MeshPhysicalMaterial({color:0x7a4f2c,roughness:.55,clearcoat:.2}));
  tag.rotation.x=-Math.PI/2;tag.position.y=0;grp.add(tag);
  const emTex=mkTex(512,512,(x)=>{x.translate(256,256);drawEmblem(x,200,'#54351d');});
  const em=new THREE.Mesh(new THREE.CircleGeometry(1.05,48),
    new THREE.MeshPhysicalMaterial({map:emTex,alphaTest:.5,roughness:.6}));
  em.rotation.x=-Math.PI/2;em.position.set(0,.37,.4);grp.add(em);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.9,.14,16,48),
    new THREE.MeshPhysicalMaterial({color:0xd8d2c8,metalness:1,roughness:.28}));
  ring.rotation.x=-Math.PI/2;ring.position.set(0,.2,-3.3);grp.add(ring);
  grp.position.set(-4,0,16);grp.rotation.y=-.5;scene.add(grp);
}

// ===== 手前の補助光（暗部起こし・弱） =====
function softbox(w,h,c,i,p,t){
  const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),
    new THREE.MeshPhysicalMaterial({emissive:new THREE.Color(c),emissiveIntensity:i,color:0x000000}));
  m.position.set(...p);m.lookAt(...t);scene.add(m);
}
softbox(30,24,0xfff0dc,2.2,[-26,26,30],[0,2,0]);   // 弱フィル(左手前上)
softbox(36,28,0xffedd4,3.4,[12,38,16],[2,0,0]);    // テーブル上キー(上方・暖)

// ===== カメラ: テーブルフォト角度 =====
const cam=new PhysicalCamera(31,W/H,.1,600);
cam.position.set(0,30,60);cam.lookAt(0,2.5,-6);
cam.focusDistance=68; cam.fStop=2.8; cam.updateProjectionMatrix();

window.__status='compile';
const pt=new WebGLPathTracer(renderer);
pt.bounces=4;pt.filterGlossyFactor=.5;pt.tiles.set(3,3);
pt.setScene(scene,cam);
window.__status='render';window.__samples=0;
(function loop(){pt.renderSample();window.__samples=pt.samples;requestAnimationFrame(loop);})();
}
main().catch(e=>{window.__err=String(e&&e.stack||e);window.__status='error';});
