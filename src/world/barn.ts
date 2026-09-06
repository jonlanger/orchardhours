/* ============================================================
   The barn — gambrel roof, cupola, silo, yard
   ============================================================ */
import * as THREE from 'three';
import { BARN_X, BARN_Z, BARN_ROT, BARN_W, BARN_H, BARN_D, TYPE_KEYS, APPLE_TYPES } from '../core/config';
import { scene } from '../core/renderer';
import { toonMat, addOutline, part, BOX, CYL, SPH } from '../core/materials';
import { groundHeightAt } from './ground';
import { APPLE_GEO } from './geometry';
import { addSolid, addPlatform } from './collision';
import { addCameraBlocker } from '../core/cameraRig';

export const BARN_POS = new THREE.Vector3(BARN_X, 0, BARN_Z);
export const barn = new THREE.Group();
barn.position.set(BARN_POS.x, groundHeightAt(BARN_POS.x, BARN_POS.z), BARN_POS.z);
barn.rotation.y = BARN_ROT;   // doors face back down the rows, toward the picker
scene.add(barn);

export const BARN_RED   = toonMat(0xA33F2E, true);
export const BARN_RED_D = toonMat(0x862F22, true);
export const TRIM       = toonMat(0xF2E4CB, true);
export const ROOF_MAT   = toonMat(0x5A626B, true);
export const STONE      = toonMat(0xBFB49B, true);
export const HOOP       = toonMat(0xA79B84, true);
export const BRASS      = new THREE.MeshStandardMaterial({ color:0xD9A441, roughness:0.35, metalness:0.6 });

const W = BARN_W, H = BARN_H, D = BARN_D;

/* ---- the shell: five panels and a doorway, not a solid block ---- */
export const WALL_T = 0.20;
export const DOOR_HALF = 1.62;          // the gap the sliding doors cover
const SEG = (W/2 - DOOR_HALF)/2;        // half-width of each front segment

export const INSIDE = toonMat(0x9A7A52, true);   // planed timber, seen from within

/** every wall panel, so the one in front of the camera can be faded */
export const wallPanels: { mesh: THREE.Mesh; nx: number; nz: number }[] = [];

function wall(w: number, h: number, d: number, x: number, y: number, z: number, nx: number, nz: number){
  const m = new THREE.Mesh(BOX(w, h, d), BARN_RED);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  addOutline(m, 1.012);
  barn.add(m);
  wallPanels.push({ mesh:m, nx, nz });
  /* a thin skin on the inner face, so indoors reads as timber not barn paint */
  const SKIN = 0.05;
  const lin = new THREE.Mesh(
    BOX(nx ? SKIN : w - 0.06, h - 0.06, nz ? SKIN : d - 0.06), INSIDE);
  lin.position.set(x - nx*(w/2 + SKIN/2 - 0.01), y, z - nz*(d/2 + SKIN/2 - 0.01));
  lin.receiveShadow = true;
  barn.add(lin);
  return m;
}

wall(W, H, WALL_T, 0, H/2, -D/2 + WALL_T/2, 0, -1);                         // back
wall(WALL_T, H, D - WALL_T*2, -W/2 + WALL_T/2, H/2, 0, -1, 0);              // left
wall(WALL_T, H, D - WALL_T*2,  W/2 - WALL_T/2, H/2, 0,  1, 0);              // right
for(const sx of [-1, 1]){
  wall(SEG*2, H, WALL_T, sx*(DOOR_HALF + SEG), H/2, D/2 - WALL_T/2, 0, 1);  // either side of the doors
}
wall(DOOR_HALF*2, H - 3.2, WALL_T, 0, 3.2 + (H - 3.2)/2, D/2 - WALL_T/2, 0, 1);  // header over the doors

/* plank battens */
for(let i=-4;i<=4;i++){
  const b = new THREE.Mesh(BOX(0.09, H*0.98, 0.06), BARN_RED_D);
  b.position.set(i*0.95, H/2, D/2+0.03); barn.add(b);
  const b2 = b.clone(); b2.position.z = -D/2-0.03; barn.add(b2);
}
for(const sx of [-1,1]){
  const t = new THREE.Mesh(BOX(0.10, 0.24, D*1.005), TRIM);
  t.position.set(sx*W/2, H-0.14, 0); barn.add(t);
}

/* gambrel roof — steep lower pitch, shallow upper, matching the gable profile below */
const EAVE_X = W/2, KNEE_X = 2.6, KNEE_Y = 2.2, PEAK_Y = 3.2;
function roofPanel(sx: number, x1: number, y1: number, x2: number, y2: number, over: number){
  const len = Math.hypot(x2-x1, y2-y1) + over;
  const p = new THREE.Mesh(BOX(len, 0.16, D*1.05), ROOF_MAT);
  p.position.set(((x1+x2)/2)*sx, H + (y1+y2)/2, 0);
  p.rotation.z = -Math.atan2(y2-y1, x1-x2) * sx;
  p.castShadow = true; p.receiveShadow = true;
  barn.add(p);
}
roofPanel( 1, EAVE_X, 0, KNEE_X, KNEE_Y, 0.42);
roofPanel(-1, EAVE_X, 0, KNEE_X, KNEE_Y, 0.42);
roofPanel( 1, KNEE_X, KNEE_Y, 0, PEAK_Y, 0.20);
roofPanel(-1, KNEE_X, KNEE_Y, 0, PEAK_Y, 0.20);
const ridge = new THREE.Mesh(BOX(0.30, 0.22, D*1.07), toonMat(0x3F4750));
ridge.position.y = H + PEAK_Y + 0.02; barn.add(ridge);

/* gable ends fill the same profile */
const gableShape = new THREE.Shape();
gableShape.moveTo(-EAVE_X, 0); gableShape.lineTo(EAVE_X, 0);
gableShape.lineTo(KNEE_X, KNEE_Y); gableShape.lineTo(0, PEAK_Y);
gableShape.lineTo(-KNEE_X, KNEE_Y); gableShape.closePath();
const gableGeo = new THREE.ExtrudeGeometry(gableShape, { depth:0.14, bevelEnabled:false });
for(const sz of [1,-1]){
  const gm = new THREE.Mesh(gableGeo, BARN_RED);
  gm.position.set(0, H, sz*D/2 - (sz>0 ? 0 : 0.14));
  gm.castShadow = true; barn.add(gm);
}
/* battens carry on up the gable */
for(let i=-2;i<=2;i++){
  const b = new THREE.Mesh(BOX(0.09, 1.9, 0.06), BARN_RED_D);
  b.position.set(i*0.95, H + 0.95, D/2+0.16); barn.add(b);
}

/* hayloft door + doors + windows on the front (+z) */
part(BOX(1.5, 1.5, 0.10), TRIM, 0, H+1.0, D/2+0.20, barn);
part(BOX(1.3, 1.3, 0.06), toonMat(0x6E4C34, true), 0, H+1.0, D/2+0.25, barn);

export const doorGrp = new THREE.Group();
doorGrp.position.set(0, 0, D/2+0.07);
barn.add(doorGrp);
export const doorLeaves: THREE.Group[] = [];
for(const sx of [-1,1]){
  const leaf = new THREE.Group();
  leaf.position.x = sx*0.80;
  doorGrp.add(leaf);
  doorLeaves.push(leaf);
  const d = part(BOX(1.55, 3.1, 0.12), TRIM, 0, 1.55, 0, leaf);
  d.castShadow = true;
  part(BOX(1.45, 0.12, 0.05), BARN_RED_D, 0, 2.95, 0.08, leaf);
  part(BOX(1.45, 0.12, 0.05), BARN_RED_D, 0, 0.16, 0.08, leaf);
  const x1 = part(BOX(1.9, 0.10, 0.05), BARN_RED_D, 0, 1.55, 0.08, leaf); x1.rotation.z = 1.10*sx;
  const x2 = part(BOX(1.9, 0.10, 0.05), BARN_RED_D, 0, 1.55, 0.08, leaf); x2.rotation.z = -1.10*sx;
}
part(BOX(3.6, 0.16, 0.14), toonMat(0x6E4C34), 0, 3.22, D/2+0.10, barn);
for(const sx of [-1,1]){
  part(BOX(0.72, 0.90, 0.10), TRIM, sx*3.0, 2.6, D/2+0.08, barn);
  part(BOX(0.58, 0.76, 0.06), toonMat(0x2E3A44), sx*3.0, 2.6, D/2+0.13, barn);
}

/* cupola + weathervane */
const cup = new THREE.Group(); cup.position.set(0, H+3.18, -1.4); barn.add(cup);
part(BOX(0.85,0.85,0.85), TRIM, 0, 0.42, 0, cup);
part(CYL(0.02,0.62,0.55,4), ROOF_MAT, 0, 1.10, 0, cup).rotation.y = Math.PI/4;
part(CYL(0.022,0.022,0.55,6), toonMat(0x3B3B43), 0, 1.62, 0, cup);
part(BOX(0.34,0.20,0.02), toonMat(0x3B3B43), 0.10, 1.88, 0, cup);
part(SPH, BRASS, 0, 1.92, 0, cup).scale.setScalar(0.05);

/* the silo stands off the west wall; world/silo.ts builds it */
export const SILO_LX = -W/2 - 2.2, SILO_LZ = -2.2;

/* yard: crates + hay bales + sign */
const CRATE_W = toonMat(0xB58347, true), CRATE_D = toonMat(0x94682F, true);
function yardCrate(x: number, z: number, ry: number){
  const c = new THREE.Group(); c.position.set(x, 0, z); c.rotation.y = ry; barn.add(c);
  const b = part(BOX(0.95,0.62,0.7), CRATE_W, 0, 0.31, 0, c); b.castShadow = true; addOutline(b,1.03);
  for(const y of [0.12,0.31,0.50]) part(BOX(0.99,0.06,0.74), CRATE_D, 0, y, 0, c);
  for(let i=0;i<4;i++){
    const a = APPLE_TYPES[TYPE_KEYS[Math.floor(Math.random()*3)]!];
    part(APPLE_GEO, toonMat(a.color, true), (Math.random()-0.5)*0.5, 0.66, (Math.random()-0.5)*0.4, c).scale.setScalar(0.14);
  }
}
yardCrate(2.9, D/2+1.5, 0.3); yardCrate(3.7, D/2+2.4, -0.5); yardCrate(2.4, D/2+2.7, 0.9);

for(const [hx,hz] of [[-3.2, D/2+1.8], [-4.0, D/2+2.9]] as const){
  const hay = part(CYL(0.62,0.62,1.0,12), toonMat(0xD9BE7A, true), hx, 0.62, hz, barn);
  hay.rotation.z = Math.PI/2; hay.castShadow = true; addOutline(hay, 1.03);
}

const sign = new THREE.Group(); sign.position.set(0, 0, D/2+3.6); barn.add(sign);
part(CYL(0.07,0.07,1.5,6), toonMat(0x6E4C34), -0.75, 0.75, 0, sign);
part(CYL(0.07,0.07,1.5,6), toonMat(0x6E4C34),  0.75, 0.75, 0, sign);
part(BOX(2.1, 0.72, 0.09), TRIM, 0, 1.35, 0, sign);
part(BOX(1.75, 0.10, 0.03), BARN_RED, 0, 1.20, 0.06, sign);
part(APPLE_GEO, toonMat(0xC63B2E, true), 0, 1.45, 0.08, sign).scale.setScalar(0.17);

/* where the bear stands to go inside */
export const barnFacing = new THREE.Vector3(0,0,1).applyAxisAngle(new THREE.Vector3(0,1,0), barn.rotation.y);
export const barnDoorPoint = BARN_POS.clone().addScaledVector(barnFacing, D/2 + 2.8);
barnDoorPoint.y = groundHeightAt(barnDoorPoint.x, barnDoorPoint.z);

/* ============================================================
   What the barn blocks, and what it lets you climb on
   ============================================================ */
const _c = Math.cos(BARN_ROT), _s = Math.sin(BARN_ROT);
/** barn-local coordinates out into the world */
export function barnToWorld(lx: number, lz: number){
  return { x: barn.position.x + lx*_c + lz*_s, z: barn.position.z - lx*_s + lz*_c };
}
export const BARN_FLOOR_Y = barn.position.y;

/* the walls, each as its own slab, so the doorway is genuinely open */
for(const [lx, lz, hw, hd] of [
  [0, -D/2 + WALL_T/2, W/2, WALL_T/2],                       // back
  [-W/2 + WALL_T/2, 0, WALL_T/2, D/2],                       // left
  [ W/2 - WALL_T/2, 0, WALL_T/2, D/2],                       // right
  [-(DOOR_HALF + SEG), D/2 - WALL_T/2, SEG, WALL_T/2],       // front, left of the doors
  [ (DOOR_HALF + SEG), D/2 - WALL_T/2, SEG, WALL_T/2],       // front, right of the doors
] as const){
  const p = barnToWorld(lx, lz);
  addSolid({ kind:'box', x:p.x, z:p.z, hw, hd, ry:BARN_ROT });
}

/* the plank floor, a step up off the yard */
export const FLOOR_TOP = BARN_FLOOR_Y + 0.14;
addPlatform({
  x: barn.position.x, z: barn.position.z, ry: BARN_ROT,
  hw: W/2 - WALL_T, hd: D/2 - WALL_T, top: FLOOR_TOP,
});

/** is this point in under the barn roof? */
export function insideBarn(x: number, z: number){
  const dx = x - barn.position.x, dz = z - barn.position.z;
  const a = -BARN_ROT;
  const lx = dx*Math.cos(a) - dz*Math.sin(a);
  const lz = dx*Math.sin(a) + dz*Math.cos(a);
  return Math.abs(lx) < W/2 && Math.abs(lz) < D/2;
}

/* hay bales — low enough to hop onto */
for(const [hx,hz] of [[-3.2, D/2+1.8], [-4.0, D/2+2.9]] as const){
  const p = barnToWorld(hx, hz);
  addSolid({ kind:'circle', x:p.x, z:p.z, r:0.66, top:BARN_FLOOR_Y + 1.24 });
}
/* yard crates — a first step up */
for(const [cx,cz,cr] of [[2.9, D/2+1.5, 0.3],[3.7, D/2+2.4,-0.5],[2.4, D/2+2.7, 0.9]] as const){
  const p = barnToWorld(cx, cz);
  addSolid({ kind:'box', x:p.x, z:p.z, hw:0.50, hd:0.37, ry:BARN_ROT+cr, top:BARN_FLOOR_Y + 0.62 });
}

addCameraBlocker(barn);
