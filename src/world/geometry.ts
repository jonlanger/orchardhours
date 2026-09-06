/* ============================================================
   Shared geometry — built once, reused by every tree, apple,
   crate and windfall in the orchard.
   ============================================================ */
import * as THREE from 'three';
import { APPLE_TYPES, TYPE_KEYS } from '../core/config';
import type { AppleType, AppleTypeDef } from '../core/config';
import { toonMat, toonSoft } from '../core/materials';

export const BRANCH_GEO = new THREE.CylinderGeometry(0.62, 1, 1, 6, 1);
BRANCH_GEO.translate(0, 0.5, 0);                     // base at origin, grows +Y

export const TRUNK_GEO = new THREE.CylinderGeometry(0.22, 0.34, 1, 10, 4);
TRUNK_GEO.translate(0, 0.5, 0);
(function flareTrunk(){                              // root flare + a little sway
  const p = TRUNK_GEO.attributes.position;
  for(let i=0;i<p.count;i++){
    const y=p.getY(i), x=p.getX(i), z=p.getZ(i);
    const flare = 1 + Math.pow(1-y, 5)*0.55;
    const lean  = Math.sin(y*3.1)*0.045;
    p.setX(i, x*flare + lean); p.setZ(i, z*flare);
  }
  TRUNK_GEO.computeVertexNormals();
})();

/* three lumpy canopy shapes so no two blobs read identical */
export const CANOPY_GEOS = [0,1,2].map(()=>{
  const g = new THREE.IcosahedronGeometry(1, 2);
  const p = g.attributes.position, v = new THREE.Vector3();
  for(let i=0;i<p.count;i++){
    v.fromBufferAttribute(p,i);
    const n = Math.sin(v.x*3.1)*Math.cos(v.y*2.7)*Math.sin(v.z*3.3);
    v.multiplyScalar(1 + n*0.16 + (Math.random()-0.5)*0.05);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
});

/* ---- the apple: lobed body, dimpled crown, stem, leaf, calyx ---- */
export const APPLE_GEO = (function(){
  const g = new THREE.SphereGeometry(1, 18, 14);
  const p = g.attributes.position, v = new THREE.Vector3();
  for(let i=0;i<p.count;i++){
    v.fromBufferAttribute(p,i);
    const theta = Math.atan2(v.z, v.x);
    const lobe = 1 + Math.cos(theta*5)*0.035;          // five soft lobes
    v.x *= lobe; v.z *= lobe;
    v.y *= 0.90;                                       // squat
    const r = Math.hypot(v.x, v.z);
    const ny = v.y/0.90;
    if(ny > 0.45) v.y -= (ny-0.45)*0.62*Math.max(0, 1 - r/0.62);   // stem well
    if(ny < -0.55) v.y += (-ny-0.55)*0.40*Math.max(0, 1 - r/0.5);  // calyx dimple
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
})();

export const STEM_GEO = new THREE.CylinderGeometry(0.035, 0.05, 0.42, 5);
STEM_GEO.translate(0, 0.21, 0);
export const LEAF_GEO = (function(){
  const s = new THREE.SphereGeometry(1, 8, 6);
  s.scale(0.34, 0.05, 0.17);
  return s;
})();
export const SPECK_GEO = new THREE.SphereGeometry(1, 6, 5);

export const appleMats = {} as Record<AppleType, THREE.Material>;
const appleBlushMats = {} as Record<AppleType, THREE.Material>;
for(const k of TYPE_KEYS){
  const def: AppleTypeDef = APPLE_TYPES[k];
  appleMats[k] = def.shine
    ? new THREE.MeshStandardMaterial({ color:def.color, roughness:0.28, metalness:0.35,
        emissive:0x6b4a00, emissiveIntensity:0.28 })
    : toonMat(def.color, true);
  appleBlushMats[k] = toonMat(def.blush, true);
}

export const STEM_MAT  = toonMat(0x6B4A33);
export const LEAF_MAT  = toonMat(0x6FA24A);
export const HILITE_MAT = new THREE.MeshBasicMaterial({ color:0xffffff, transparent:true, opacity:0.30 });
export const BARK_MAT  = toonMat(0x8A6544, true);
export const BARK_DARK = toonMat(0x6E4C34, true);
export const CANOPY_BASE = 0x6FA24A;

export const APPLE_SCALE = 0.19;

/* ============================================================
   The marks an apple wears at its best.

   A ring of short dashes standing off the fruit, drawn in apple-local units
   so they ride the group's own scale. Three shared materials, pulsed a little
   out of step with each other, keep the whole crop to three draw states.
   ============================================================ */
const MARK_GEO = new THREE.BoxGeometry(0.125, 1, 0.05);
MARK_GEO.translate(0, 0.5, 0);                       // grows outward from the origin

export const MARK_MATS = [0,1,2].map(() => new THREE.MeshBasicMaterial({
  color:0xFFEEB4, transparent:true, opacity:0.42, depthWrite:false }));

/** eight dashes in the group's XY plane, so a lookAt is all the facing it needs */
export function buildRipeMark(mat: THREE.Material){
  const g = new THREE.Group();
  for(let i=0;i<8;i++){
    const a = (i/8)*Math.PI*2;
    const m = new THREE.Mesh(MARK_GEO, mat);
    m.position.set(Math.sin(a)*1.55, Math.cos(a)*1.55, 0);
    m.rotation.z = -a;
    m.scale.y = i % 2 ? 0.52 : 0.94;                 // long, short, long, short
    g.add(m);
  }
  return g;
}

export function buildApple(type: AppleType){
  const g = new THREE.Group();
  const body = new THREE.Mesh(APPLE_GEO, appleMats[type]);
  body.castShadow = true;
  g.add(body);
  // blushed cheek — a slightly smaller offset shell reading as sun-side colour
  const cheek = new THREE.Mesh(APPLE_GEO, appleBlushMats[type]);
  cheek.scale.setScalar(1.008);
  cheek.position.set(0.16, 0.02, 0.10);
  cheek.scale.multiplyScalar(0.86);
  g.add(cheek);
  const hi = new THREE.Mesh(SPECK_GEO, HILITE_MAT);
  hi.scale.set(0.30, 0.20, 0.16);
  hi.position.set(-0.42, 0.52, 0.55);
  g.add(hi);
  const stem = new THREE.Mesh(STEM_GEO, STEM_MAT);
  stem.position.y = 0.72; stem.rotation.z = 0.22; stem.rotation.x = 0.1;
  g.add(stem);
  const leaf = new THREE.Mesh(LEAF_GEO, LEAF_MAT);
  leaf.position.set(0.30, 1.02, 0.04);
  leaf.rotation.set(0.2, 0.5, -0.55);
  g.add(leaf);
  g.scale.setScalar(APPLE_SCALE);
  return g;
}

export { toonSoft };
