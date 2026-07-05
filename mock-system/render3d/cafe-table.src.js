import * as THREE from 'three';
import { WebGLPathTracer, PhysicalCamera } from 'three-gpu-pathtracer';

window.__status='init'; window.__err=null;
async function main(){
const W=window.__W||700, H=window.__H||525;
const canvas=document.getElementById('c');
const renderer=new THREE.WebGLRenderer({canvas,antialias:false,preserveDrawingBuffer:true});
renderer.setSize(W,H,false);
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.32;
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
// 手続きテクスチャ: 織り目ノーマルマップ
function mkWeaveNormal(scale=28, strength=1.4){
  const S=512, c=document.createElement('canvas');c.width=c.height=S;
  const x=c.getContext('2d'), img=x.createImageData(S,S);
  const Hgt=(i,j)=>Math.sin(i*Math.PI*2*scale/S)*Math.sin(j*Math.PI*2*scale/S)
      +.35*Math.sin((i*7+j*13)*.13)+.2*Math.sin((i*29-j*17)*.031);
  for(let j=0;j<S;j++)for(let i=0;i<S;i++){
    const dx=(Hgt(i+1,j)-Hgt(i-1,j))*strength, dy=(Hgt(i,j+1)-Hgt(i,j-1))*strength;
    const inv=1/Math.sqrt(dx*dx+dy*dy+1), p=(j*S+i)*4;
    img.data[p]=(-dx*inv*.5+.5)*255; img.data[p+1]=(-dy*inv*.5+.5)*255;
    img.data[p+2]=(inv*.5+.5)*255; img.data[p+3]=255;
  }
  x.putImageData(img,0,0);
  const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;return t;
}
// ラフネス変化マップ（中心0.5グレー±ムラ）
function mkRoughMap(blotch=.16, freq=6){
  const S=512, c=document.createElement('canvas');c.width=c.height=S;
  const x=c.getContext('2d');
  x.fillStyle='#808080';x.fillRect(0,0,S,S);
  for(let i=0;i<220;i++){
    const g=Math.round(128+(Math.sin(i*12.9898)*43758.5453%1)*blotch*255);
    const v=Math.max(60,Math.min(200,g));
    x.fillStyle=`rgba(${v},${v},${v},.25)`;
    const r=20+((i*7919)%90);
    x.beginPath();x.arc((i*7717)%S,(i*3571)%S,r,0,7);x.fill();
  }
  const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;return t;
}
const weaveN=mkWeaveNormal(48,1.05);
const roughVar=mkRoughMap();
const roughVar2=mkRoughMap(.22,9);

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
      x.beginPath();const yy=(i*137.5)%1024;
      x.moveTo(0,yy);x.bezierCurveTo(300,yy+20,700,yy-25,1024,yy+10);x.stroke();
    }
    // 使用感: 微細なスクラッチ
    for(let i=0;i<14;i++){
      x.strokeStyle='rgba(210,190,160,.10)';x.lineWidth=1;
      const sx=(i*761)%1024, sy=(i*389)%1024, ang=((i*97)%180)*Math.PI/180, len=40+(i*53)%160;
      x.beginPath();x.moveTo(sx,sy);x.lineTo(sx+Math.cos(ang)*len,sy+Math.sin(ang)*len);x.stroke();
    }
  });
  woodTex.wrapS=woodTex.wrapT=THREE.RepeatWrapping;woodTex.repeat.set(1.35,1.35);
  const tbl=new THREE.Mesh(new THREE.PlaneGeometry(160,90),
    new THREE.MeshPhysicalMaterial({map:woodTex,roughness:.45,clearcoat:.35,clearcoatRoughness:.32,roughnessMap:roughVar2}));
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
  for(const [bx,bh,bc] of [[-62,9,0x7a5a2e],[-54,7,0x44614a],[-47,10,0x8a6a3a],[-38,6,0x5a4838],[-30,8,0x6e5540]]){
    scene.add(M(new THREE.CylinderGeometry(1.7,1.7,bh,20),bc,.3,[bx,5.5+bh/2,-72]));
    scene.add(M(new THREE.CylinderGeometry(.55,.75,2.2,14),bc,.3,[bx,5.5+bh+1.1,-72]));}
  // 窓(右奥・暖光)=メインキー
  const win=EM(new THREE.PlaneGeometry(46,52),0xffe2b6,6.5,[52,8,-62]);
  win.lookAt(0,4,0);scene.add(win);
  scene.add(M(new THREE.BoxGeometry(3,52,4),0x241a10,.8,[38,8,-58]));                // 窓枠
  // 窓の桟(格子)
  const mull=new THREE.MeshPhysicalMaterial({color:0x1e150c,roughness:.8});
  for(const off of [-10.5,3.2]){const m=new THREE.Mesh(new THREE.BoxGeometry(1.6,52,1.6),mull);
    m.position.set(52+off*.35,8,-61.4);m.lookAt(0,8,0);scene.add(m);}
  {const m=new THREE.Mesh(new THREE.BoxGeometry(46,1.6,1.6),mull);
   m.position.set(52,14,-61.6);m.lookAt(0,14,0);scene.add(m);}
  // 吊り電球(ペンダント)
  for(const [px,py,pz] of [[-14,26,-48],[8,23,-44],[26,27,-52]]){
    scene.add(EM(new THREE.SphereGeometry(1.5,16,16),0xffc98a,20,[px,py,pz]));
    scene.add(M(new THREE.CylinderGeometry(.15,.15,20,8),0x1a130c,.8,[px,py+11,pz]));
  }
  // 遠くの丸テーブル+椅子の気配(右)
  scene.add(M(new THREE.CylinderGeometry(12,12,1.5,32),0x3f3022,.5,[30,-8,-72]));
  scene.add(M(new THREE.CylinderGeometry(1.2,1.2,18,12),0x2c2117,.6,[30,-18,-72]));
  // 観葉植物(左)
  for(const [px,py,pz,pr,pc] of [[-25,4,-62,2.2,0x2e4a34],[-22,7,-64,1.8,0x37573d],[-27,8,-63,1.6,0x2a4531],[-23,10,-65,1.4,0x3d5c42],[-26,11,-64,1.2,0x314d38],[-21,4.5,-63,1.5,0x355239],[-24,6,-61,1.3,0x2e4a34]])
    scene.add(M(new THREE.SphereGeometry(pr,16,16),pc,.75,[px,py,pz]));
}

// ===== アイテム（実物スケール） =====
const fabric=new THREE.MeshPhysicalMaterial({color:0x423a30,roughness:.94,
  normalMap:weaveN, normalScale:new THREE.Vector2(.4,.4), roughnessMap:roughVar});

// エプロン: 畳んだ布(皺の変位ジオメトリ・プリント部は皺を抑制)
{
  const grp=new THREE.Group();
  const WCLOTH=34, HCLOTH=24, SEG=110;
  const geo=new THREE.PlaneGeometry(WCLOTH,HCLOTH,SEG,Math.round(SEG*HCLOTH/WCLOTH));
  const pos=geo.attributes.position;
  const emX=3.2, emZ=-4.5;  // プリント位置(ローカル)
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i), y=pos.getY(i);
    const edge=Math.min(1,(1-Math.abs(x)/(WCLOTH/2))*3)*Math.min(1,(1-Math.abs(y)/(HCLOTH/2))*3);
    let h=.55*Math.sin(x*.42+2.1*Math.sin(y*.23))
         +.4*Math.sin(y*.62+1.7*Math.sin(x*.19))
         +.22*Math.sin(x*1.7+y*2.3)
         +1.1*Math.exp(-Math.pow((x*.707+y*.707-3)/3.2,2));   // 斜めの折りひだ
    const dEm=Math.hypot(x-emX,-y-emZ);
    h*=(1-Math.exp(-dEm*dEm/18))*.9+.1;                        // プリント部は平らに
    pos.setZ(i, h*edge+.35);
  }
  geo.computeVertexNormals();
  const cloth=new THREE.Mesh(geo,fabric);
  cloth.rotation.x=-Math.PI/2;grp.add(cloth);
  const emTex=mkTex(512,512,(x)=>{x.translate(256,256);drawEmblem(x,200,CREAM);});
  const em=new THREE.Mesh(new THREE.CircleGeometry(3,48),
    new THREE.MeshPhysicalMaterial({map:emTex,alphaTest:.5,roughness:.88,
      normalMap:weaveN,normalScale:new THREE.Vector2(.4,.4)}));
  em.rotation.x=-Math.PI/2;em.position.set(emX,.62,emZ);grp.add(em);
  grp.position.set(-17,0,1);grp.rotation.y=.22;scene.add(grp);
}
// キャップ: 実寸 クラウンφ17.6
{
  const grp=new THREE.Group();
  const pts=[];const P=(r,y)=>pts.push(new THREE.Vector2(r,y));
  P(0,5.8);P(3.5,5.4);P(6.4,4.2);P(8.2,2.2);P(8.75,.6);P(8.75,0);
  grp.add(new THREE.Mesh(new THREE.LatheGeometry(pts,64),fabric));
  const btn=new THREE.Mesh(new THREE.SphereGeometry(.6,16,16),fabric);btn.position.y=5.8;grp.add(btn);
  // パネル縫い目(6本・ドーム表面に沿うアーク)
  const domeR=(y)=>{ // 高さyでのドーム半径(プロファイル近似)
    const p=[[5.8,0],[5.4,3.5],[4.2,6.4],[2.2,8.2],[.6,8.75],[0,8.75]];
    for(let k=0;k<p.length-1;k++){const[y1,r1]=p[k],[y2,r2]=p[k+1];
      if(y<=y1&&y>=y2)return r1+(r2-r1)*(y1-y)/(y1-y2);}
    return 8.75;};
  const seamMat=new THREE.MeshPhysicalMaterial({color:0x352e26,roughness:.95});
  for(let k=0;k<6;k++){
    const phi=k*Math.PI/3+.26;
    const ptsArc=[];
    for(let t=0;t<=10;t++){const y=5.6*(1-t/10)+.3*(t/10);
      const r=domeR(y)+.06;
      ptsArc.push(new THREE.Vector3(Math.sin(phi)*r,y,Math.cos(phi)*r));}
    grp.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ptsArc),24,.09,8,false),seamMat));
  }
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
  const bodyMat=new THREE.MeshPhysicalMaterial({map:bodyTex,roughness:.4,clearcoat:.55,clearcoatRoughness:.3,roughnessMap:roughVar});
  const ceramic=new THREE.MeshPhysicalMaterial({color:0xf1ece0,roughness:.4,clearcoat:.55,clearcoatRoughness:.3,roughnessMap:roughVar});
  const mug=new THREE.Mesh(new THREE.LatheGeometry(pts,128,-Math.PI,Math.PI*2),bodyMat);
  const hp=[new THREE.Vector3(3.8,6.75,0),new THREE.Vector3(6.55,6.25,0),new THREE.Vector3(6.55,3.85,0),new THREE.Vector3(3.85,3.3,0)];
  const handle=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hp,false,'catmullrom',.6),120,.5,28,false),ceramic);
  // コーヒー液面(クレマのリング付き)
  const coffeeTex=mkTex(512,512,(x)=>{
    const g0=x.createRadialGradient(256,256,80,256,256,250);
    g0.addColorStop(0,'#1c0f07');g0.addColorStop(.75,'#241207');
    g0.addColorStop(.9,'#5a3a1c');g0.addColorStop(1,'#7a5528');   // 縁にクレマ
    x.fillStyle=g0;x.fillRect(0,0,512,512);
    // クレマの泡ムラ
    for(let i=0;i<40;i++){const a=(i*137)%360*Math.PI/180, rr=215+((i*53)%28);
      x.fillStyle='rgba(150,105,55,.25)';
      x.beginPath();x.arc(256+Math.cos(a)*rr*.45,256+Math.sin(a)*rr*.45,3+(i%5),0,7);x.fill();}
  });
  const coffee=new THREE.Mesh(new THREE.CircleGeometry(3.74,64),
    new THREE.MeshPhysicalMaterial({map:coffeeTex,roughness:.06,clearcoat:.9,clearcoatRoughness:.08}));
  coffee.rotation.x=-Math.PI/2;coffee.position.y=8.1;
  const g=new THREE.Group();g.add(mug);g.add(handle);g.add(coffee);
  g.position.set(2,0,7);g.rotation.y=.35;scene.add(g);
  // コーヒー豆(楕円体+割れ目)を無造作に
  const beanMat=new THREE.MeshPhysicalMaterial({color:0x54331b,roughness:.48,clearcoat:.3,roughnessMap:roughVar});
  const creaseMat=new THREE.MeshPhysicalMaterial({color:0x241105,roughness:.85});
  const mkBean=(bx,by,bz,rot)=>{
    const bean=new THREE.Group();
    const b=new THREE.Mesh(new THREE.SphereGeometry(.66,24,18),beanMat);
    b.scale.set(1,.55,.72);bean.add(b);
    const cr=new THREE.Mesh(new THREE.BoxGeometry(1.15,.12,.13),creaseMat);
    cr.position.y=.3;bean.add(cr);
    bean.position.set(bx,by,bz);bean.rotation.y=rot;bean.rotation.z=(rot%1)*.18;
    scene.add(bean);
  };
  // ソーサー(豆の置き皿=物語の理由付け)
  const saucer=new THREE.Mesh(new THREE.CylinderGeometry(4.4,3.6,.5,48),
    new THREE.MeshPhysicalMaterial({color:0xf1ece0,roughness:.4,clearcoat:.5,clearcoatRoughness:.3,roughnessMap:roughVar}));
  saucer.position.set(-7,.25,12.5);scene.add(saucer);
  mkBean(-7.8,.62,12.0,.5); mkBean(-6.4,.62,13.2,2.2); mkBean(-7.1,.62,11.4,3.8);
  // テーブルにこぼれた2粒
  mkBean(-2.2,.34,14.6,1.1); mkBean(9.8,.34,14.2,2.9);
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
  const brushTex=(()=>{const c=document.createElement('canvas');c.width=c.height=512;
    const x=c.getContext('2d');x.fillStyle='#787878';x.fillRect(0,0,512,512);
    for(let i=0;i<3200;i++){const g=96+((i*7717)%80);x.strokeStyle=`rgba(${g},${g},${g},.4)`;
      const px=(i*331)%512;x.beginPath();x.moveTo(px,0);x.lineTo(px+((i*13)%7)-3,512);x.stroke();}
    const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;return t;})();
  const mat=new THREE.MeshPhysicalMaterial({map:tex,metalness:.85,roughness:.42,roughnessMap:brushTex});
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
  const matTop=new THREE.MeshPhysicalMaterial({map:cardTex,roughness:.65});
  const matSide=new THREE.MeshPhysicalMaterial({color:0xf0ebe0,roughness:.7});
  // 束=無地ボックス、その上にテクスチャ付き薄カードを重ねる(単一マテリアル同士)
  const stackBase=new THREE.Mesh(new THREE.BoxGeometry(9.1,.62,5.5),matSide);
  stackBase.position.set(11.5,.31,10);stackBase.rotation.y=-.2;scene.add(stackBase);
  const stackTop=new THREE.Mesh(new THREE.BoxGeometry(9.08,.06,5.48),matTop);
  stackTop.position.set(11.5,.65,10);stackTop.rotation.y=-.2;scene.add(stackTop);
  const lean=new THREE.Mesh(new THREE.BoxGeometry(9.1,.06,5.5),matTop);
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
  const hole=new THREE.Path();hole.absarc(0,h-.85,.42,0,Math.PI*2,true);sh.holes.push(hole);
  const tag=new THREE.Mesh(new THREE.ExtrudeGeometry(sh,{depth:.35,bevelEnabled:true,bevelThickness:.05,bevelSize:.05,bevelSegments:2}),
    new THREE.MeshPhysicalMaterial({color:0x7a4f2c,roughness:.55,clearcoat:.2,roughnessMap:roughVar2}));
  tag.rotation.x=-Math.PI/2;tag.position.y=0;grp.add(tag);
  const emTex=mkTex(512,512,(x)=>{x.translate(256,256);drawEmblem(x,200,'#54351d');});
  const em=new THREE.Mesh(new THREE.CircleGeometry(1.05,48),
    new THREE.MeshPhysicalMaterial({map:emTex,alphaTest:.5,roughness:.6}));
  em.rotation.x=-Math.PI/2;em.position.set(0,.37,.4);grp.add(em);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.9,.13,16,48),
    new THREE.MeshPhysicalMaterial({color:0xd8d2c8,metalness:1,roughness:.3,roughnessMap:roughVar}));
  ring.rotation.x=-Math.PI/2-.18;ring.position.set(0,.16,-3.05);grp.add(ring);  // タグの穴を通る位置
  grp.position.set(.5,0,17);grp.rotation.y=-.35;scene.add(grp);
}

// ===== 手前の補助光（暗部起こし・弱） =====
function softbox(w,h,c,i,p,t){
  const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),
    new THREE.MeshPhysicalMaterial({emissive:new THREE.Color(c),emissiveIntensity:i,color:0x000000}));
  m.position.set(...p);m.lookAt(...t);scene.add(m);
}
softbox(30,24,0xfff0dc,2.2,[-26,26,30],[0,2,0]);   // 弱フィル(左手前上)
softbox(36,28,0xffedd4,4.4,[12,38,16],[2,0,0]);    // テーブル上キー(上方・暖)

// ===== カメラ: テーブルフォト角度 =====
const cam=new PhysicalCamera(31,W/H,.1,600);
cam.position.set(0,30,60);cam.lookAt(0,2.5,-6);
cam.focusDistance=68; cam.fStop=2.8; cam.apertureBlades=6; cam.updateProjectionMatrix();

window.__status='compile';
const pt=new WebGLPathTracer(renderer);
pt.bounces=4;pt.filterGlossyFactor=.5;pt.tiles.set(3,3);
pt.setScene(scene,cam);
window.__status='render';window.__samples=0;
(function loop(){pt.renderSample();window.__samples=pt.samples;requestAnimationFrame(loop);})();
}
main().catch(e=>{window.__err=String(e&&e.stack||e);window.__status='error';});
