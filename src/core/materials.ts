/* ============================================================
   Toon helpers — flat-shaded ramps, ink outlines, primitives
   ============================================================ */
import * as THREE from 'three';

function makeToonGradient(steps: number[]){
  const c = document.createElement('canvas'); c.width = steps.length; c.height = 1;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(steps.length, 1);
  steps.forEach((v,i)=>{ img.data[i*4]=v; img.data[i*4+1]=v; img.data[i*4+2]=v; img.data[i*4+3]=255; });
  ctx.putImageData(img,0,0);
  const t = new THREE.CanvasTexture(c);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  return t;
}
export const toonGradient = makeToonGradient([88,150,208,255]);
export const toonSoft     = makeToonGradient([120,168,206,232,255]);

const matCache = new Map<string, THREE.MeshToonMaterial>();
export function toonMat(color: number, soft = false){
  const k = color+'|'+soft;
  let m = matCache.get(k);
  if(!m){
    m = new THREE.MeshToonMaterial({ color, gradientMap: soft ? toonSoft : toonGradient });
    matCache.set(k, m);
  }
  return m;
}

const outlineMats = new Map<number, THREE.MeshBasicMaterial>();
function outlineMat(color: number){
  let m = outlineMats.get(color);
  if(!m){
    m = new THREE.MeshBasicMaterial({ color, side:THREE.BackSide });
    outlineMats.set(color, m);
  }
  return m;
}

/** every ink hull in the scene, so the settings toggle can hide them at once */
export const outlines: THREE.Mesh[] = [];

export function addOutline(mesh: THREE.Mesh, scale = 1.05, color = 0x2f2016){
  const o = new THREE.Mesh(mesh.geometry, outlineMat(color));
  o.scale.setScalar(scale);
  o.renderOrder = -1;
  mesh.add(o);
  outlines.push(o);
  return o;
}

/* ---- primitives every builder reaches for ---- */
export const SPH = new THREE.SphereGeometry(1, 16, 12);
export const CAP = (r: number, l: number) => new THREE.CapsuleGeometry(r, l, 4, 10);
export const BOX = (w: number, h: number, d: number) => new THREE.BoxGeometry(w,h,d);
export const CYL = (rt: number, rb: number, h: number, s = 14) => new THREE.CylinderGeometry(rt,rb,h,s);

export const UP = new THREE.Vector3(0,1,0);
/** point a +Y-grown mesh down an arbitrary direction */
export function orient(mesh: THREE.Object3D, dir: THREE.Vector3){
  mesh.quaternion.setFromUnitVectors(UP, dir.clone().normalize());
}

/** attach a mesh to a parent at a position, casting shadows like everything else */
export function part(geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0, parent: THREE.Object3D){
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x,y,z);
  m.castShadow = true;
  parent.add(m);
  return m;
}

/* ---- the shared fade used for canopies (and, later, the barn roof) ---- */
export interface Fadeable {
  mats: THREE.Material[];
  outlines: THREE.Object3D[];
  fade: number;
}

/**
 * Ease a group of materials toward transparent and back. Returns true if it
 * moved, so callers can skip the material churn on a settled group.
 */
export function fadeGroup(f: Fadeable, want: number, dt: number, showOutlines: boolean){
  if(Math.abs(f.fade - want) <= 0.002) return false;
  f.fade += (want - f.fade) * Math.min(1, dt*7);
  const clear = f.fade > 0.985;
  for(const m of f.mats){
    (m as THREE.MeshToonMaterial).opacity = f.fade;
    m.transparent = !clear;
    m.depthWrite = clear;
  }
  if(showOutlines) f.outlines.forEach(o => { o.visible = clear; });
  return true;
}
