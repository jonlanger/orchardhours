/* ============================================================
   Fence, meadow detail, hills, clouds, petals
   ============================================================ */
import * as THREE from 'three';
import { FX1, FX2, FZ1, FZ2, TYPE_KEYS, APPLE_TYPES, BARN_X, BARN_Z } from '../core/config';
import { scene } from '../core/renderer';
import { toonMat, BOX } from '../core/materials';
import { state } from '../core/save';
import { groundHeightAt } from './ground';
import { APPLE_GEO, CANOPY_GEOS, toonSoft } from './geometry';

/* ---- the ring fence ---- */
export const FENCE = new THREE.Group(); scene.add(FENCE);
const POST_GEO = BOX(0.16, 1.15, 0.16);
const RAIL_GEO = BOX(1, 0.10, 0.07);
const FENCE_MAT = toonMat(0x8A6A4A, true);
const FENCE_MAT_D = toonMat(0x6E5238, true);

function fenceRun(x1: number, z1: number, x2: number, z2: number){
  const len = Math.hypot(x2-x1, z2-z1);
  const n = Math.round(len/2.6);
  for(let i=0;i<=n;i++){
    const t = i/n, x = x1+(x2-x1)*t, z = z1+(z2-z1)*t;
    const p = new THREE.Mesh(POST_GEO, FENCE_MAT);
    p.position.set(x, groundHeightAt(x,z)+0.55, z);
    p.rotation.y = Math.atan2(x2-x1, z2-z1);
    p.castShadow = true; FENCE.add(p);
    if(i<n){
      const nx = x1+(x2-x1)*((i+1)/n), nz = z1+(z2-z1)*((i+1)/n);
      for(const yy of [0.78, 0.44]){
        const r = new THREE.Mesh(RAIL_GEO, FENCE_MAT_D);
        r.position.set((x+nx)/2, (groundHeightAt(x,z)+groundHeightAt(nx,nz))/2 + yy, (z+nz)/2);
        r.scale.x = Math.hypot(nx-x, nz-z)*1.02;
        r.rotation.y = Math.atan2(nx-x, nz-z) + Math.PI/2;
        r.castShadow = true; FENCE.add(r);
      }
    }
  }
}
fenceRun(FX1,FZ1,FX2,FZ1); fenceRun(FX1,FZ2,FX2,FZ2);
fenceRun(FX1,FZ1,FX1,FZ2); fenceRun(FX2,FZ1,FX2,FZ2);

/* ---- grass tufts ---- */
const bladeGeo = (function(){
  const g = new THREE.ConeGeometry(0.035, 0.22, 3);
  g.translate(0, 0.11, 0);
  return g;
})();
const GRASS_COUNT = 900;
const grass = new THREE.InstancedMesh(bladeGeo, toonMat(0x9BC46A, true), GRASS_COUNT);
grass.receiveShadow = true;
{
  const d = new THREE.Object3D(), col = new THREE.Color();
  grass.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(GRASS_COUNT*3), 3);
  for(let i=0;i<GRASS_COUNT;i++){
    const x = (Math.random()-0.5)*76, z = (Math.random()-0.5)*76 + 6;
    d.position.set(x, groundHeightAt(x,z), z);
    d.rotation.set((Math.random()-0.5)*0.3, Math.random()*6.28, (Math.random()-0.5)*0.3);
    d.scale.setScalar(0.5 + Math.random()*0.7);
    d.updateMatrix(); grass.setMatrixAt(i, d.matrix);
    col.setHex(0x9BC46A).offsetHSL(0,(Math.random()-0.5)*0.08,(Math.random()-0.5)*0.10);
    grass.setColorAt(i, col);
  }
}
scene.add(grass);

/* ---- windfall apples and small stones in the lanes ---- */
for(let i=0;i<26;i++){
  const x = (Math.random()-0.5)*48, z = (Math.random()-0.5)*52 + 4;
  if(Math.hypot(x - BARN_X, z - BARN_Z) < 8) continue;
  if(Math.random() < 0.55){
    const t = TYPE_KEYS[Math.floor(Math.random()*3)]!;
    const f = new THREE.Mesh(APPLE_GEO, toonMat(APPLE_TYPES[t].color, true));
    f.position.set(x, groundHeightAt(x,z)+0.13, z);
    f.rotation.set(Math.random()*3, Math.random()*3, 1.3);
    f.scale.setScalar(0.15); f.castShadow = true; scene.add(f);
  } else {
    const s = new THREE.Mesh(CANOPY_GEOS[1]!, toonMat(0xA9A092, true));
    s.position.set(x, groundHeightAt(x,z)+0.06, z);
    s.scale.set(0.16,0.10,0.13); s.castShadow = true; scene.add(s);
  }
}

/* ---- distant hills, unlit-flat so they read as background ---- */
for(let i=0;i<11;i++){
  const a = (i/11)*Math.PI*2 + 0.3;
  const r = 78 + Math.random()*26;
  const h = new THREE.Mesh(CANOPY_GEOS[i%3]!, toonMat(i%2 ? 0x7E9E74 : 0x8FAA7E, true));
  h.position.set(Math.cos(a)*r, -3 - Math.random()*2, Math.sin(a)*r);
  h.scale.set(20+Math.random()*14, 9+Math.random()*6, 17+Math.random()*12);
  scene.add(h);
}

/* ---- clouds ---- */
const clouds = new THREE.Group(); scene.add(clouds);
const CLOUD_MAT = new THREE.MeshToonMaterial({ color:0xFFFDF6, gradientMap:toonSoft, fog:false });
for(let i=0;i<9;i++){
  const c = new THREE.Group();
  const puffs = 3 + Math.floor(Math.random()*3);
  for(let j=0;j<puffs;j++){
    const p = new THREE.Mesh(CANOPY_GEOS[j%3]!, CLOUD_MAT);
    p.position.set((j-puffs/2)*2.6 + Math.random(), Math.random()*1.2, Math.random()*2-1);
    p.scale.set(2.6+Math.random()*1.6, 1.5+Math.random()*0.7, 2.2+Math.random());
    c.add(p);
  }
  c.position.set((Math.random()-0.5)*130, 26 + Math.random()*14, (Math.random()-0.5)*130);
  c.userData.drift = 0.16 + Math.random()*0.22;
  clouds.add(c);
}

/* ---- petals / leaves on the breeze ---- */
const PETAL_COUNT = 260;
const petalTex = (function(){
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d')!;
  const rg = g.createRadialGradient(16,16,0,16,16,16);
  rg.addColorStop(0,'rgba(255,255,255,1)'); rg.addColorStop(0.5,'rgba(255,255,255,0.7)'); rg.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle = rg; g.beginPath(); g.ellipse(16,16,15,11,0,0,6.3); g.fill();
  return new THREE.CanvasTexture(c);
})();
const petalPos = new Float32Array(PETAL_COUNT*3);
const petalCol = new Float32Array(PETAL_COUNT*3);
const petalVel: { fall:number; drift:number; spin:number }[] = [];
{
  const pc = new THREE.Color();
  for(let i=0;i<PETAL_COUNT;i++){
    petalPos[i*3]   = (Math.random()-0.5)*54;
    petalPos[i*3+1] = Math.random()*11 + 0.5;
    petalPos[i*3+2] = (Math.random()-0.5)*54;
    pc.setHex(Math.random()<0.5 ? 0xF6E9C9 : 0xE8D2A8).offsetHSL(0,(Math.random()-0.5)*0.2,(Math.random()-0.5)*0.1);
    petalCol[i*3]=pc.r; petalCol[i*3+1]=pc.g; petalCol[i*3+2]=pc.b;
    petalVel.push({ fall:0.28+Math.random()*0.42, drift:Math.random()*6.28, spin:0.4+Math.random()*0.9 });
  }
}
const petalGeo = new THREE.BufferGeometry();
petalGeo.setAttribute('position', new THREE.BufferAttribute(petalPos,3));
petalGeo.setAttribute('color', new THREE.BufferAttribute(petalCol,3));
export const petals = new THREE.Points(petalGeo, new THREE.PointsMaterial({
  size:0.14, map:petalTex, vertexColors:true, transparent:true, opacity:0.85,
  depthWrite:false, sizeAttenuation:true,
}));
scene.add(petals);

export function updateProps(dt: number, time: number){
  const windScale = state.settings.calm ? 0.45 : 1;

  clouds.children.forEach(c => {
    c.position.x += (c.userData.drift as number)*dt*windScale;
    if(c.position.x > 78) c.position.x = -78;
  });

  if(!state.settings.petals) return;
  const p = petalGeo.attributes.position;
  for(let i=0;i<PETAL_COUNT;i++){
    const v = petalVel[i]!;
    let y = p.getY(i) - v.fall*dt*windScale;
    let x = p.getX(i) + Math.sin(time*v.spin + v.drift)*0.9*dt*windScale + 0.25*dt*windScale;
    let z = p.getZ(i) + Math.cos(time*v.spin*0.7 + v.drift)*0.6*dt*windScale;
    if(y < 0){ y = 11 + Math.random()*3; x = (Math.random()-0.5)*54; z = (Math.random()-0.5)*54; }
    if(x > 30) x = -30;
    p.setXYZ(i, x, y, z);
  }
  p.needsUpdate = true;
}
