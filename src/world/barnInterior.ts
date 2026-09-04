/* ============================================================
   Inside the barn — the floor you walk on, the barrels the
   season goes into, and the rack the tools hang on.
   ============================================================ */
import * as THREE from 'three';
import { APPLE_TYPES, TYPE_KEYS, CRATE_CAPACITY, BARN_W, BARN_D, BARN_ROT } from '../core/config';
import type { AppleType } from '../core/config';
import { state, basketTotal } from '../core/save';
import type { ToolId } from '../core/save';
import { toonMat, addOutline, part, BOX, CYL, fadeGroup } from '../core/materials';
import type { Fadeable } from '../core/materials';
import { scene } from '../core/renderer';
import { APPLE_GEO, appleMats } from './geometry';
import { addSolid, addPlatform } from './collision';
import {
  barn, barnToWorld, BARN_FLOOR_Y, FLOOR_TOP, WALL_T, DOOR_HALF,
  doorLeaves, insideBarn, wallPanels, TRIM, ROOF_MAT, BARN_RED, INSIDE,
} from './barn';
import { character } from '../player/rig';
import { startClimb } from '../player/controller';
import { addInteractable } from '../player/interact';
import { carrying, putBack, take, setRackSpot, setBarrowHome, TOOLS, TOOL_ORDER } from '../player/tools';
import { barrowHandy, barrowTotal } from '../player/picking';
import { deposit, openBarn } from '../ui/overlays';
import { toast } from '../ui/hud';

const W = BARN_W, D = BARN_D;

const PLANK      = toonMat(0xA8834E, true);
const PLANK_DARK = toonMat(0x8A6636, true);
const BEAM       = toonMat(0x6E5238, true);
const OAK        = toonMat(0xB08048, true);
const OAK_DARK   = toonMat(0x8C6234, true);
const IRON       = toonMat(0x59606B, true);
const SLATE      = toonMat(0x2E3A36, true);
const HAY        = toonMat(0xD9BE7A, true);

/* everything indoors hangs off this, so it inherits the barn's place and turn */
const inside = new THREE.Group();
inside.position.y = 0.0;
barn.add(inside);

/* ---- floor ---- */
{
  const f = part(BOX(W - WALL_T*2, 0.14, D - WALL_T*2), PLANK, 0, 0.07, 0, inside);
  f.receiveShadow = true;
  for(let i=-5;i<=5;i++){
    part(BOX(0.04, 0.02, D - WALL_T*2), PLANK_DARK, i*0.72, 0.145, 0, inside);
  }
  /* a ramp of a threshold so the step in reads */
  part(BOX(DOOR_HALF*2, 0.10, 0.5), PLANK_DARK, 0, 0.05, D/2 - WALL_T - 0.22, inside);
}

/* ---- posts and ceiling beams ---- */
for(const sx of [-1, 1]){
  for(const lz of [-3.2, 0.4, 3.6]){
    const p = part(BOX(0.18, 4.2, 0.18), BEAM, sx*(W/2 - 0.75), 2.1, lz, inside);
    p.castShadow = true;
    const w = barnToWorld(sx*(W/2 - 0.75), lz);
    addSolid({ kind:'circle', x:w.x, z:w.z, r:0.20 });
  }
}
for(const lz of [-3.2, 0.4, 3.6]){
  part(BOX(W - 1.2, 0.20, 0.20), BEAM, 0, 4.05, lz, inside);
}

/* ---- the hayloft over the back third ---- */
const LOFT_Y = 2.65, LOFT_Z = -D/2 + 2.1, LOFT_D = 3.6;
{
  const deck = part(BOX(W - WALL_T*2 - 0.1, 0.16, LOFT_D), PLANK, 0, LOFT_Y, LOFT_Z, inside);
  deck.castShadow = deck.receiveShadow = true;
  part(BOX(W - WALL_T*2 - 0.1, 0.14, 0.14), BEAM, 0, LOFT_Y - 0.14, LOFT_Z + LOFT_D/2, inside);
  const w = barnToWorld(0, LOFT_Z);
  addPlatform({ x:w.x, z:w.z, ry:BARN_ROT, hw:(W - WALL_T*2 - 0.1)/2, hd:LOFT_D/2, top:BARN_FLOOR_Y + LOFT_Y + 0.08 });

  /* the fixed ladder up to it */
  const lx = W/2 - 1.15, lz = LOFT_Z + LOFT_D/2 + 0.20;
  for(const sx of [-1, 1]) part(BOX(0.06, LOFT_Y + 0.3, 0.06), OAK_DARK, lx + sx*0.22, (LOFT_Y + 0.3)/2, lz, inside);
  for(let y = 0.35; y < LOFT_Y + 0.1; y += 0.32) part(BOX(0.48, 0.05, 0.05), OAK, lx, y, lz, inside);

  /* hay up top, and one bale tipped down onto the floor */
  for(let i=0;i<3;i++){
    const b = part(CYL(0.42,0.42,0.72,10), HAY, -1.6 + i*1.5, LOFT_Y + 0.50, LOFT_Z - 0.6 + (i%2)*0.7, inside);
    b.rotation.z = Math.PI/2; b.castShadow = true; addOutline(b, 1.04);
  }
  const loose = part(CYL(0.42,0.42,0.72,10), HAY, W/2 - 1.15, 0.56, D/2 - 2.3, inside);
  loose.rotation.z = Math.PI/2; loose.castShadow = true; addOutline(loose, 1.04);
  const lw = barnToWorld(W/2 - 1.15, D/2 - 2.3);
  addSolid({ kind:'circle', x:lw.x, z:lw.z, r:0.46, top:FLOOR_TOP + 0.84 });

  /* a ladder-climb interactable for the loft */
  const climbAt = barnToWorld(lx, lz + 0.5);
  addInteractable({
    id:'loft-ladder',
    at: new THREE.Vector3(climbAt.x, 0, climbAt.z),
    range: 0.95,
    anyAngle: true,
    label: () => character.position.y < BARN_FLOOR_Y + 1.2 ? 'Climb up to the loft' : null,
    use: () => {
      const at = barnToWorld(lx, lz + 0.45);
      startClimb(at.x, at.z, FLOOR_TOP, BARN_FLOOR_Y + LOFT_Y + 0.30, BARN_ROT + Math.PI);
    },
  });
}

/* ============================================================
   The barrels — one per variety, along the left wall
   ============================================================ */
interface Barrel {
  type: AppleType;
  group: THREE.Group;
  fruit: THREE.InstancedMesh;
  lid: THREE.Mesh;
  /** the chalked fill line on the label board */
  gauge: THREE.Mesh;
}
const BARREL_R = 0.48, BARREL_H = 0.86, BARREL_FRUIT = 22;
const barrels: Barrel[] = [];

TYPE_KEYS.forEach((k, i) => {
  const def = APPLE_TYPES[k];
  const lx = -W/2 + 0.95, lz = -2.7 + i*1.55;
  const g = new THREE.Group();
  g.position.set(lx, 0.14, lz);
  inside.add(g);

  /* staves, bulging at the waist the way a cooper makes them, and open on top
     so you can see the season pile up inside */
  const wall = new THREE.Mesh(
    new THREE.CylinderGeometry(BARREL_R*0.86, BARREL_R*0.86, BARREL_H, 16, 1, true), OAK);
  wall.material = OAK.clone();
  (wall.material as THREE.MeshToonMaterial).side = THREE.DoubleSide;
  wall.position.y = BARREL_H/2;
  wall.castShadow = wall.receiveShadow = true;
  g.add(wall);
  addOutline(wall, 1.04, 0x4a3626);
  const waist = new THREE.Mesh(
    new THREE.CylinderGeometry(BARREL_R, BARREL_R, BARREL_H*0.42, 16, 1, true), wall.material);
  waist.position.y = BARREL_H/2;
  g.add(waist);
  part(CYL(BARREL_R*0.84, BARREL_R*0.84, 0.06, 16), OAK_DARK, 0, 0.05, 0, g);   // the head
  for(const y of [0.12, BARREL_H/2, BARREL_H - 0.12]){
    part(new THREE.TorusGeometry(BARREL_R*0.94, 0.028, 5, 20), IRON, 0, y, 0, g).rotation.x = Math.PI/2;
  }
  /* a chalked board naming what goes in, with a line marking how full it is */
  part(BOX(0.34, 0.46, 0.02), TRIM, 0, BARREL_H*0.52, BARREL_R*0.94, g);
  part(BOX(0.24, 0.045, 0.012), toonMat(def.color, true), 0, BARREL_H*0.52 + 0.16, BARREL_R*0.99, g);
  const gauge = part(BOX(0.20, 1, 0.012), toonMat(def.color, true), 0, 0, BARREL_R*0.99, g);
  gauge.scale.y = 0.001;

  /* what is in it: a cap of apples that climbs as the season fills */
  const fruit = new THREE.InstancedMesh(APPLE_GEO, appleMats[k], BARREL_FRUIT);
  fruit.castShadow = true;
  fruit.count = 0;
  g.add(fruit);

  const lid = part(CYL(BARREL_R*0.80, BARREL_R*0.80, 0.05, 16), OAK_DARK, 0, BARREL_H - 0.02, 0, g);

  const w = barnToWorld(lx, lz);
  addSolid({ kind:'circle', x:w.x, z:w.z, r:BARREL_R + 0.05, top:FLOOR_TOP + BARREL_H });

  const b: Barrel = { type:k, group:g, fruit, lid, gauge };
  barrels.push(b);

  addInteractable({
    id:'barrel-'+k,
    at: new THREE.Vector3(w.x, 0, w.z),
    range: 1.9,
    label: () => {
      const have = state.basket[k] + (barrowHandy() ? state.barrow!.load[k] : 0);
      if(!have) return null;
      const name = state.discovered[k] ? def.label : 'this variety';
      return `Tip ${have} ${have === 1 ? 'apple' : 'apples'} of ${name} into the barrel`;
    },
    use: () => { deposit(k, barrowHandy()); refreshBarrels(); },
  });
});

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(0.125,0.125,0.125);
const _p = new THREE.Vector3();

export function refreshBarrels(){
  for(const b of barrels){
    const frac = Math.min(1, state.stored[b.type]/CRATE_CAPACITY);
    const n = state.stored[b.type] === 0 ? 0 : Math.max(1, Math.round(frac*BARREL_FRUIT));
    b.fruit.count = n;
    /* the heap sits on a rising floor inside the barrel */
    const surface = 0.26 + frac*(BARREL_H - 0.34);
    for(let i=0;i<n;i++){
      const a = (i*2.399);                                  // a lazy spiral, no two the same
      const r = Math.sqrt(i/BARREL_FRUIT)*BARREL_R*0.58;
      _p.set(Math.cos(a)*r, surface + (i%3)*0.05 - 0.02, Math.sin(a)*r);
      _q.setFromAxisAngle(new THREE.Vector3(0,1,0), a);
      _m.compose(_p, _q, _s);
      b.fruit.setMatrixAt(i, _m);
    }
    b.fruit.instanceMatrix.needsUpdate = true;
    b.lid.visible = frac < 0.02;
    /* the chalk line: 0.26 tall at full, growing up from the foot of the board */
    const h = Math.max(0.004, frac*0.26);
    b.gauge.scale.y = h;
    b.gauge.position.y = BARREL_H*0.52 - 0.20 + h/2;
  }
}
refreshBarrels();

/* ---- the sorting table in the middle: tip everything at once ---- */
{
  const lx = 0.4, lz = 0.6;
  const top = part(BOX(1.5, 0.10, 0.95), PLANK, lx, 0.98, lz, inside);
  top.castShadow = true; addOutline(top, 1.03, 0x4a3626);
  for(const [ox, oz] of [[-0.66,-0.38],[0.66,-0.38],[-0.66,0.38],[0.66,0.38]] as const){
    part(BOX(0.09, 0.85, 0.09), OAK_DARK, lx+ox, 0.55, lz+oz, inside);
  }
  /* a shallow crate of ungraded fruit sitting on it */
  part(BOX(0.62, 0.20, 0.42), OAK, lx - 0.35, 1.13, lz, inside);
  for(let i=0;i<7;i++){
    const t = TYPE_KEYS[i % 3]!;
    part(APPLE_GEO, appleMats[t],
      lx - 0.55 + (i%4)*0.145, 1.21 + (i%2)*0.02, lz - 0.11 + ((i/4)|0)*0.16, inside).scale.setScalar(0.095);
  }
  const w = barnToWorld(lx, lz);
  addSolid({ kind:'box', x:w.x, z:w.z, hw:0.80, hd:0.52, ry:BARN_ROT, top:FLOOR_TOP + 0.89 });
  addInteractable({
    id:'sorting-table',
    at: new THREE.Vector3(w.x, 0, w.z),
    range: 1.9,
    label: () => {
      const n = basketTotal() + (barrowHandy() ? barrowTotal() : 0);
      return n ? `Sort all ${n} into the barrels` : null;
    },
    use: () => { deposit(null, barrowHandy()); refreshBarrels(); },
  });
}

/* ============================================================
   The tool rack on the right wall
   ============================================================ */
{
  const lx = W/2 - 0.42;
  const board = part(BOX(0.10, 1.5, 3.0), OAK, lx, 1.9, 1.35, inside);
  board.receiveShadow = true;
  for(const lz of [0.4, 1.0, 1.4, 2.0, 2.4]){
    part(CYL(0.035,0.035,0.26,6), OAK_DARK, lx - 0.16, 2.25, lz, inside).rotation.z = Math.PI/2;
  }
  part(BOX(0.06, 0.16, 3.0), OAK_DARK, lx - 0.06, 1.18, 1.35, inside);

  /* where each tool sits when it is hung up, in world space */
  const spots: Record<ToolId, { lx:number; lz:number; y:number; rot:[number,number,number] }> = {
    picker:  { lx: lx - 0.30, lz: 2.40, y: 0.60, rot:[0.16, 0, 0.05] },
    shears:  { lx: lx - 0.24, lz: 1.40, y: 2.10, rot:[0, 0, 0] },
    lantern: { lx: lx - 0.24, lz: 0.40, y: 2.05, rot:[0, 0, 0] },
    ladder:  { lx: lx - 0.55, lz: 3.60, y: 0.16, rot:[0.10, 0, 0.06] },
    barrow:  { lx: -1.5,      lz: 3.60, y: 0.16, rot:[0, Math.PI*0.9, 0] },
  };

  scene.updateMatrixWorld(true);
  for(const id of TOOL_ORDER){
    const sp = spots[id];
    const w = barnToWorld(sp.lx, sp.lz);
    if(id === 'barrow'){
      setBarrowHome(w.x, w.z, BARN_ROT + sp.rot[1]);
    } else {
      setRackSpot(id,
        new THREE.Vector3(w.x, BARN_FLOOR_Y + sp.y + 0.14, w.z),
        new THREE.Euler(sp.rot[0], BARN_ROT + sp.rot[1], sp.rot[2]));
    }

    const at = new THREE.Vector3(w.x, 0, w.z);
    addInteractable({
      id:'rack-'+id,
      at,
      range: 1.8,
      label: () => {
        const def = TOOLS[id];
        if(carrying(id)) return `Hang the ${def.label} back up`;
        if(id === 'ladder' && state.ladder) return null;      // it is out leaning on a tree
        if(id === 'barrow' && state.barrow &&
           Math.hypot(state.barrow.x - w.x, state.barrow.z - w.z) > 1.2) return null;
        return `Take the ${def.label}`;
      },
      use: () => {
        if(carrying(id)){ putBack(id); toast(`The ${TOOLS[id].label} is back on the rack.`); }
        else { take(id); toast(`${TOOLS[id].note}`); }
      },
    });
  }
}

/* ---- the chalkboard, and the almanac on the bench ---- */
{
  const board = part(BOX(2.0, 1.15, 0.06), SLATE, -0.6, 2.35, -D/2 + WALL_T + 0.08, inside);
  part(BOX(2.12, 0.08, 0.09), OAK_DARK, -0.6, 1.74, -D/2 + WALL_T + 0.10, inside);
  for(let i=0;i<5;i++){
    part(BOX(1.2 - i*0.14, 0.03, 0.01), toonMat(0xE8E2D0), -0.85, 2.72 - i*0.20, -D/2 + WALL_T + 0.12, inside);
  }
  void board;
  const w = barnToWorld(-0.6, -D/2 + WALL_T + 0.5);
  addInteractable({
    id:'chalkboard', at:new THREE.Vector3(w.x, 0, w.z), range:1.9,
    label: () => 'Read the ledger',
    use: () => openBarn('ledger'),
  });

  /* a workbench with the almanac open on it */
  const bx = 1.9, bz = -D/2 + 1.0;
  const bench = part(BOX(1.7, 0.10, 0.7), PLANK, bx, 0.98, bz, inside);
  bench.castShadow = true; addOutline(bench, 1.03, 0x4a3626);
  for(const ox of [-0.72, 0.72]) part(BOX(0.10, 0.85, 0.60), OAK_DARK, bx+ox, 0.55, bz, inside);
  const book = part(BOX(0.44, 0.06, 0.32), TRIM, bx - 0.2, 1.06, bz, inside);
  book.rotation.y = 0.24;
  part(BOX(0.05, 0.07, 0.33), toonMat(0x8E3A2B), bx - 0.42, 1.06, bz, inside).rotation.y = 0.24;
  const bw = barnToWorld(bx, bz + 0.7);
  addInteractable({
    id:'almanac', at:new THREE.Vector3(bw.x, 0, bw.z), range:1.7,
    label: () => 'Open the almanac',
    use: () => openBarn('almanac'),
  });
  const sw = barnToWorld(bx, bz);
  addSolid({ kind:'box', x:sw.x, z:sw.z, hw:0.88, hd:0.38, ry:BARN_ROT, top:FLOOR_TOP + 0.89 });
}

/* ---- a stack of empty crates in the corner ---- */
for(let i=0;i<3;i++){
  const c = part(BOX(0.9, 0.56, 0.66), OAK, -W/2 + 1.15, 0.44 + i*0.58, D/2 - 1.5, inside);
  c.rotation.y = (i%2)*0.09 - 0.04;
  c.castShadow = true;
  if(i === 0) addOutline(c, 1.03, 0x4a3626);
}
{
  const w = barnToWorld(-W/2 + 1.15, D/2 - 1.5);
  addSolid({ kind:'box', x:w.x, z:w.z, hw:0.48, hd:0.36, ry:BARN_ROT, top:FLOOR_TOP + 1.60 });
}

/* ============================================================
   Light indoors, doors that open, and a roof that gets out of
   the way when you are underneath it
   ============================================================ */
const lampA = new THREE.PointLight(0xFFD9A6, 0, 12, 1.5);
lampA.position.set(0, 3.4, -2.0);
inside.add(lampA);
const lampB = new THREE.PointLight(0xFFE3C0, 0, 12, 1.5);
lampB.position.set(0, 3.2, 3.0);
inside.add(lampB);

const roofFade: Fadeable = { mats: [], outlines: [], fade: 1 };
{
  const seen = new Set<THREE.Material>();
  for(const m of [ROOF_MAT, BARN_RED, INSIDE]) void m;
  /* the roof panels, the ridge and the gables all share ROOF_MAT/BARN_RED, and
     fading those would take the whole barn with them — so clone per mesh */
  barn.traverse(o => {
    const mesh = o as THREE.Mesh;
    if(!mesh.isMesh) return;
    if(mesh.position.y < 4.0) return;                    // only what is above the walls
    const mat = mesh.material as THREE.Material;
    if(!seen.has(mat)){
      seen.add(mat);
    }
    const clone = (mat as THREE.MeshToonMaterial).clone();
    mesh.material = clone;
    roofFade.mats.push(clone);
  });
}

const wallFades: (Fadeable & { nx:number; nz:number })[] = wallPanels.map(w => {
  const clone = (w.mesh.material as THREE.MeshToonMaterial).clone();
  w.mesh.material = clone;
  return { mats:[clone], outlines:[], fade:1, nx:w.nx, nz:w.nz };
});

const _toCam = new THREE.Vector3();
let doorOpen = 0;

export function updateBarnInterior(dt: number, camPos: THREE.Vector3){
  const here = insideBarn(character.position.x, character.position.z);

  /* the doors roll aside as you come up to them, and close behind you */
  const near = character.position.distanceTo(
    new THREE.Vector3(...(() => { const p = barnToWorld(0, D/2 + 1.2); return [p.x, character.position.y, p.z]; })())) < 4.0;
  const want = (here || near) ? 1 : 0;
  doorOpen += (want - doorOpen)*Math.min(1, dt*3);
  doorLeaves.forEach((leaf, i) => {
    leaf.position.x = (i === 0 ? -0.80 : 0.80) + (i === 0 ? -1 : 1)*doorOpen*1.45;
  });

  /* the roof lifts off while you are under it */
  fadeGroup(roofFade, here ? 0.12 : 1, dt, false);

  /* and so does whichever wall the camera is looking through */
  _toCam.subVectors(camPos, barn.position).normalize();
  const c = Math.cos(BARN_ROT), s = Math.sin(BARN_ROT);
  const lx = _toCam.x*c - _toCam.z*s, lz = _toCam.x*s + _toCam.z*c;
  for(const f of wallFades){
    const facing = f.nx*lx + f.nz*lz;
    fadeGroup(f, here && facing > 0.25 ? 0.10 : 1, dt, false);
  }

  const warm = here ? 1 : 0;
  lampA.intensity += (warm*2.4 - lampA.intensity)*Math.min(1, dt*3);
  lampB.intensity += (warm*1.8 - lampB.intensity)*Math.min(1, dt*3);
}

export { insideBarn };
