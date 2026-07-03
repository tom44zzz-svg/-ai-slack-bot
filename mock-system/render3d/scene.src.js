import * as THREE from 'three';
import { WebGLPathTracer, PhysicalCamera } from 'three-gpu-pathtracer';

window.__status = 'init';
window.__err = null;
async function main(){

// ---------- renderer ----------
const W = window.__W || 1280, H = window.__H || 960;
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
renderer.setSize(W, H, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

// ---------- scene ----------
const scene = new THREE.Scene();

// environment: soft warm gradient equirect
{
  const w=64,h=32,data=new Float32Array(w*h*4);
  for(let y=0;y<h;y++){for(let x=0;x<w;x++){
    const t=y/(h-1); // 0 top -> 1 bottom
    const top=[1.0,0.93,0.82], hor=[0.55,0.5,0.44], bot=[0.12,0.10,0.08];
    let c; if(t<0.5){const k=t/0.5; c=top.map((v,i)=>v*(1-k)+hor[i]*k);} else {const k=(t-0.5)/0.5; c=hor.map((v,i)=>v*(1-k)+bot[i]*k);}
    const i=(y*w+x)*4; data[i]=c[0]*0.5; data[i+1]=c[1]*0.5; data[i+2]=c[2]*0.5; data[i+3]=1;
  }}
  const tex=new THREE.DataTexture(data,w,h,THREE.RGBAFormat,THREE.FloatType);
  tex.mapping=THREE.EquirectangularReflectionMapping; tex.needsUpdate=true;
  scene.environment=tex;
}

// floor (dark walnut, subtle gloss)
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(300,300),
  new THREE.MeshPhysicalMaterial({ color:0x2b211a, roughness:0.34, clearcoat:0.35, clearcoatRoughness:0.25 })
);
floor.rotation.x = -Math.PI/2; scene.add(floor);

// backdrop wall
const wall = new THREE.Mesh(
  new THREE.PlaneGeometry(300,160),
  new THREE.MeshPhysicalMaterial({ color:0xa89c88, roughness:0.95 })
);
wall.position.set(0,80,-38); scene.add(wall);

// ---------- mug geometry ----------
// profile (r, y) cm — outer wall up, rim, inner wall down
const pts = [];
const P=(r,y)=>pts.push(new THREE.Vector2(r,y));
P(0.0,0.18); P(1.6,0.18); P(2.9,0.22); P(3.55,0.38); P(3.95,0.75); P(4.12,1.4); P(4.2,2.4);
P(4.22,4.0); P(4.22,6.5); P(4.2,8.6); P(4.18,9.15); P(4.12,9.42); P(3.98,9.5); // rim top (rounded lip)
P(3.84,9.42); P(3.8,9.1); P(3.78,8.2); P(3.76,5.0); P(3.7,2.2); P(3.3,1.35); P(2.4,1.1); P(0.0,1.05);
const bodyGeo = new THREE.LatheGeometry(pts, 96);
const ceramic = new THREE.MeshPhysicalMaterial({
  color: 0xf1ece0, roughness: 0.36, metalness: 0.0,
  clearcoat: 0.55, clearcoatRoughness: 0.28,
});
const mug = new THREE.Mesh(bodyGeo, ceramic);
scene.add(mug);

// handle: tube along curve in XZ->XY plane (x outward, y up), placed +X side
const hpts = [
  new THREE.Vector3(3.8, 6.75, 0),
  new THREE.Vector3(6.55, 6.25, 0),
  new THREE.Vector3(6.55, 3.85, 0),
  new THREE.Vector3(3.85, 3.3, 0),
];
const curve = new THREE.CatmullRomCurve3(hpts, false, 'catmullrom', 0.6);
const handle = new THREE.Mesh(new THREE.TubeGeometry(curve, 160, 0.5, 36, false), ceramic);
scene.add(handle);

// rotate mug+handle so handle sits to the right-back (like v4)
mug.rotation.y = 0; handle.rotation.y = -0.35; // slight turn
// group them
const g = new THREE.Group(); g.add(mug); g.add(handle); scene.add(g);
g.rotation.y = 0.12;

// ---------- logo decal (cylindrical wrap) ----------
window.__status = 'font';
const cnv = document.createElement('canvas'); cnv.width=2048; cnv.height=1024;
const ctx = cnv.getContext('2d');
await document.fonts.load("700 240px 'SM'", "灯り屋");
await document.fonts.load("500 64px 'SM'", "YONEZAWA");
ctx.clearRect(0,0,2048,1024);
ctx.fillStyle = '#262019';
ctx.textAlign='center'; ctx.textBaseline='middle';
ctx.font = "700 236px 'SM'";
// manual letterspacing for 灯り屋
const chars=['灯','り','屋']; const cw=300; const total=cw*3+2*70; let x=1024-total/2+cw/2;
for(const ch of chars){ ctx.fillText(ch, x, 430); x+=cw+70; }
ctx.font = "500 58px 'SM'"; ctx.fillStyle = '#8f6a2e';
const sub='YONEZAWA — AKARIYA';
ctx.save(); ctx.translate(1024,700); ctx.scale(1.0,1.0);
// letterspaced
let sx=0; const sp=14; ctx.textAlign='left';
const widths=[...sub].map(c=>ctx.measureText(c).width);
const totalW=widths.reduce((a,b)=>a+b,0)+sp*(sub.length-1);
sx=-totalW/2;
[...sub].forEach((c,i)=>{ ctx.fillText(c,sx,0); sx+=widths[i]+sp; });
ctx.restore();

const logoTex = new THREE.CanvasTexture(cnv);
logoTex.colorSpace = THREE.SRGBColorSpace;
logoTex.anisotropy = 8;
const thetaLen = 1.5;
const decal = new THREE.Mesh(
  new THREE.CylinderGeometry(4.235,4.235,4.4,128,1,true, -thetaLen/2, thetaLen),
  new THREE.MeshPhysicalMaterial({ map: logoTex, alphaTest: 0.5, transparent: false,
    roughness: 0.52, clearcoat: 0.35, clearcoatRoughness: 0.3 })
);
decal.position.y = 4.9;
scene.add(decal);

// ---------- lights (emissive softboxes) ----------
function softbox(w,h,color,intensity,pos,lookAt){
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w,h),
    new THREE.MeshBasicMaterial({ color, side:THREE.DoubleSide }));
  m.material = new THREE.MeshPhysicalMaterial({ emissive: new THREE.Color(color), emissiveIntensity: intensity, color: 0x000000 });
  m.position.set(...pos); m.lookAt(...lookAt); scene.add(m); return m;
}
softbox(26,32, 0xfff0dd, 9.0, [-20, 20, 14], [0,5,0]);   // key upper-left
softbox(34,18, 0xfff3e2, 2.0, [-4, 30, 2], [2, 6, -38]);  // wall wash (out of frame, lights backdrop)
softbox(20,20, 0xdfe4ec, 1.4, [17, 9, 16], [0,5,0]);     // cool fill right
softbox(6,20,  0xffe9c8, 5.0, [19, 15, -8], [0,7,0]);   // warm rim back-right (out of frame)

// ---------- camera ----------
const camera = new PhysicalCamera(28, W/H, 0.1, 400);
camera.position.set(-0.8, 14.2, 33.5);
camera.lookAt(0, 4.3, 0);
camera.focusDistance = 33.0;
camera.fStop = 4.0;
camera.updateProjectionMatrix();

// ---------- path tracer ----------
window.__status = 'compile';
const pt = new WebGLPathTracer(renderer);
pt.bounces = 5;
pt.filterGlossyFactor = 0.5;
pt.tiles.set(3,3);
pt.setScene(scene, camera);

window.__status = 'render';
window.__samples = 0;
function loop(){
  pt.renderSample();
  window.__samples = pt.samples;
  requestAnimationFrame(loop);
}
loop();

}
main().catch(e=>{ window.__err = String(e && e.stack || e); window.__status='error'; });
