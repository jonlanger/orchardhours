/* ============================================================
   Inside the barn — the floor you walk on, the barrels the
   season goes into, the rack the tools hang on, and the stairs
   that carry on up to the loft and out onto the roof deck.
   ============================================================ */
import * as THREE from 'three';
import { APPLE_TYPES, TYPE_KEYS, CRATE_CAPACITY, EXTRA_BAY_CAPACITY,
         BARN_W, BARN_D, BARN_ROT } from '../core/config';
import type { AppleType } from '../core/config';
import { state, save, basketTotal, built, storeCap } from '../core/save';
import { on } from '../core/bus';
import type { ToolId } from '../core/save';
import { toonMat, addOutline, part, BOX, CYL, fadeGroup } from '../core/materials';
import type { Fadeable } from '../core/materials';
import { scene } from '../core/renderer';
import { APPLE_GEO, appleMats } from './geometry';
import { addSolid, addPlatform } from './collision';
import { groundHeightAt } from './ground';
import {
  barn, barnToWorld, BARN_FLOOR_Y, FLOOR_TOP, WALL_T, DOOR_HALF,
  doorLeaves, insideBarn, wallPanels, roofParts, TRIM,
  LOFT_Y, LOFT_SURFACE, LOFT_TOP, LOFT_Z, LOFT_D,
  DECK_Y, DECK_Z1, WELL_X1, WELL_Z0, WELL_Z1, roofOver,
  WALK_Y, WALK_TOP, CUPOLA_Z,
} from './barn';
import { character } from '../player/rig';
import { addInteractable } from '../player/interact';
import { setIndoors } from '../core/cameraRig';
import { carrying, putBack, take, setRackSpot, setBarrowHome, TOOLS, TOOL_ORDER } from '../player/tools';
import { barrowHandy, barrowTotal } from '../player/picking';
import { deposit, openBarn } from '../ui/overlays';
import { toast, renderBasket } from '../ui/hud';

const W = BARN_W, D = BARN_D;

const PLANK      = toonMat(0xA8834E, true);
const PLANK_DARK = toonMat(0x8A6636, true);
const BEAM       = toonMat(0x6E5238, true);
const OAK        = toonMat(0xB08048, true);
const OAK_DARK   = toonMat(0x8C6234, true);
const IRON       = toonMat(0x59606B, true);
const SLATE      = toonMat(0x2E3A36, true);

/* everything indoors hangs off this, so it inherits the barn's place and turn */
const inside = new THREE.Group();
inside.position.y = 0.0;
barn.add(inside);

/* ---- floor ---- */
{
  const f = part(BOX(W - WALL_T*2, 0.14, D - WALL_T*2), PLANK, 0, 0.07, 0, inside);
  f.receiveShadow = true;
  for(let i=-7;i<=7;i++){
    part(BOX(0.04, 0.02, D - WALL_T*2), PLANK_DARK, i*0.72, 0.145, 0, inside);
  }
  /* a ramp of a threshold so the step in reads */
  part(BOX(DOOR_HALF*2, 0.10, 0.5), PLANK_DARK, 0, 0.05, D/2 - WALL_T - 0.22, inside);
}

/* ---- posts and beams ----
   The front half is tied across at rafter height; the back half is open all
   the way up to the deck, and its posts carry the deck joists instead. */
for(const sx of [-1, 1]){
  for(const [lz, h] of [[-3.2, DECK_Y - 0.30], [0.4, 4.5], [3.6, 4.5]] as const){
    const p = part(BOX(0.18, h, 0.18), BEAM, sx*(W/2 - 1.9), h/2, lz, inside);
    p.castShadow = true;
    const w = barnToWorld(sx*(W/2 - 1.9), lz);
    addSolid({ kind:'circle', x:w.x, z:w.z, r:0.20 });
  }
}
for(const lz of [0.4, 3.6]){
  part(BOX(W - 3.4, 0.20, 0.20), BEAM, 0, 4.4, lz, inside);
}

/* ============================================================
   Stairs.

   Both ladders are gone. Every way up the barn is a flight now, and a flight
   is walked rather than used — no prompt, no key, just steps. The treads are
   platforms rather than solids: a solid riser would shove the bear back down
   the instant it met one, where a platform simply catches the foot as it goes
   over. Everything is built in the flight's own frame, +z running up the
   slope, so a run across the barn and a run along it are the same code.
   ============================================================ */
interface Stair { topX: number; topZ: number; top: number }
function stair(fx: number, fz: number, ang: number, steps: number,
               rise: number, run: number, halfW: number, base: number,
               rails: number[] = [], onRoof = false): Stair {
  const keep = (m: THREE.Mesh) => { if(onRoof) roofParts.push(m); return m; };
  const g = new THREE.Group();
  g.position.set(fx, 0, fz);
  g.rotation.y = ang;
  inside.add(g);

  for(let i=0;i<steps;i++){
    const top = base + rise*(i+1);
    const z = run*(i + 0.5);
    const t = keep(part(BOX(halfW*2, 0.10, run + 0.06), PLANK, 0, top - 0.05, z, g));
    t.castShadow = t.receiveShadow = true;
    /* the closed mass of the flight under the tread, so it is stairs and not
       a stack of floating boards */
    keep(part(BOX(halfW*2 - 0.06, Math.max(0.02, top - base - 0.10), run - 0.04), OAK_DARK,
         0, base + (top - base - 0.10)/2, z, g));
    const p = barnToWorld(fx + Math.sin(ang)*z, fz + Math.cos(ang)*z);
    addPlatform({ x:p.x, z:p.z, ry:BARN_ROT + ang,
                  hw:halfW, hd:run/2 + 0.04, top:BARN_FLOOR_Y + top });
  }

  /* a handrail down whichever sides are open to the room */
  const rise_ = steps*rise, run_ = steps*run;
  for(const side of rails){
    const r = keep(part(BOX(0.07, 0.07, Math.hypot(run_, rise_) + 0.24), OAK,
      side, base + 0.92 + rise_/2, run_/2, g));
    r.rotation.x = -Math.atan2(rise_, run_);
    for(let i=0;i<=steps;i+=2){
      keep(part(BOX(0.08, 0.94, 0.08), OAK, side, base + rise*i + 0.47, run*i, g));
    }
  }

  return { topX: fx + Math.sin(ang)*run_, topZ: fz + Math.cos(ang)*run_,
           top: base + rise_ };
}

/* ---- the hayloft over the back of the barn ---- */
const LOFT_FRONT = LOFT_Z + LOFT_D/2;
{
  const deck = part(BOX(W - WALL_T*2 - 0.1, 0.16, LOFT_D), PLANK, 0, LOFT_Y, LOFT_Z, inside);
  deck.castShadow = deck.receiveShadow = true;
  part(BOX(W - WALL_T*2 - 0.1, 0.14, 0.14), BEAM, 0, LOFT_Y - 0.14, LOFT_FRONT, inside);
  const w = barnToWorld(0, LOFT_Z);
  addPlatform({ x:w.x, z:w.z, ry:BARN_ROT, hw:(W - WALL_T*2 - 0.1)/2, hd:LOFT_D/2, top:LOFT_TOP });
}

/* ---- the stair up to it, against the east wall ---- */
const STAIR_X = W/2 - 0.85, STAIR_HALF = 0.55;
{
  const steps = 10;
  const rise = (LOFT_SURFACE - 0.14)/steps, run = 0.335;
  /* the foot is far enough forward that the top tread lands on the loft edge */
  stair(STAIR_X, LOFT_FRONT + run*steps, Math.PI, steps, rise, run,
        STAIR_HALF, 0.14, [STAIR_HALF - 0.06]);
}

/* a rail along the open edge of the loft, with the stairhead left clear */
{
  /* wide enough that a bear coming up the flight at either edge of the treads
     still walks through it, rather than being fended off by its own banister */
  const gap = STAIR_X - STAIR_HALF - 0.45;
  const x0 = -(W/2 - WALL_T), x1 = gap;
  const cx = (x0 + x1)/2, len = x1 - x0;
  for(const y of [0.88, 0.48]){
    part(BOX(len, 0.07, 0.07), OAK, cx, LOFT_SURFACE + y, LOFT_FRONT, inside);
  }
  for(let x = x0; x <= x1 + 0.01; x += len/Math.ceil(len/1.1)){
    part(BOX(0.09, 0.96, 0.09), OAK, x, LOFT_SURFACE + 0.48, LOFT_FRONT, inside);
  }
  const w = barnToWorld(cx, LOFT_FRONT);
  addSolid({ kind:'box', x:w.x, z:w.z, hw:len/2, hd:0.10, ry:BARN_ROT,
             on: () => character.position.y > LOFT_TOP - 0.8
                    && character.position.y < LOFT_TOP + 1.6 });
}

/* ============================================================
   And on up out of the loft to the roof deck — a flight along the loft,
   a landing, and a second flight turning east through the stairwell.
   ============================================================ */
{
  const halfW = 0.55;
  const steps = 7;
  const mid = (LOFT_SURFACE + DECK_Y)/2;
  const riseA = (mid - LOFT_SURFACE)/steps, run = 0.343;
  const LAND_X = -1.30, LAND_Z = (WELL_Z0 + WELL_Z1)/2;

  /* up the loft, running back toward the wall */
  stair(LAND_X, LAND_Z + halfW + run*steps, Math.PI, steps, riseA, run,
        halfW, LOFT_SURFACE, [-(halfW - 0.06), halfW - 0.06]);

  /* the half-landing it turns on */
  {
    const l = part(BOX(halfW*2, 0.12, halfW*2), PLANK, LAND_X, mid - 0.06, LAND_Z, inside);
    l.castShadow = l.receiveShadow = true;
    part(BOX(halfW*2 - 0.06, mid - LOFT_SURFACE - 0.12, halfW*2 - 0.04), OAK_DARK,
         LAND_X, LOFT_SURFACE + (mid - LOFT_SURFACE - 0.12)/2, LAND_Z, inside);
    const w = barnToWorld(LAND_X, LAND_Z);
    addPlatform({ x:w.x, z:w.z, ry:BARN_ROT, hw:halfW, hd:halfW, top:BARN_FLOOR_Y + mid });

    /* a rail across the back of it and down the side open to the loft */
    for(const [ox, oz, hw, hd] of [
      [0, -halfW, halfW, 0.05],
      [-halfW, 0, 0.05, halfW],
    ] as const){
      for(const y of [0.88, 0.48]){
        part(BOX(hw*2 || 0.07, 0.07, hd*2 || 0.07), OAK,
             LAND_X + ox, mid + y, LAND_Z + oz, inside);
      }
      part(BOX(0.09, 0.96, 0.09), OAK, LAND_X + ox, mid + 0.48, LAND_Z + oz, inside);
    }
  }

  /* and out through the hole in the deck */
  const riseB = (DECK_Y - mid)/steps;
  stair(LAND_X + halfW, LAND_Z, Math.PI/2, steps, riseB, run,
        halfW, mid, [-(halfW - 0.06), halfW - 0.06]);

  /* What holds the bear on all of it.
     The landing is a shelf two metres over the loft and the flight beyond it
     climbs out through a hole in the roof, so both are railed down their open
     sides — as one run each, from the landing to the deck. A guard that
     stopped at the landing's corner would stand across the flight instead of
     alongside it, and fend off the bear coming down. The two ends the stairs
     themselves use are left open. */
  const onTheStair = () => character.position.y > BARN_FLOOR_Y + mid - 0.9;
  for(const [x0, z0, x1, z1] of [
    [LAND_X - halfW, WELL_Z0 + 0.02, WELL_X1 + 0.06, WELL_Z0 + 0.02],   // the north side, all of it
    [LAND_X + halfW, WELL_Z1 - 0.02, WELL_X1 + 0.06, WELL_Z1 - 0.02],   // the south side of the flight
    [LAND_X - halfW, WELL_Z0 + 0.02, LAND_X - halfW, WELL_Z1 - 0.02],   // and the far end of the landing
  ] as const){
    const w = barnToWorld((x0 + x1)/2, (z0 + z1)/2);
    addSolid({ kind:'box', x:w.x, z:w.z,
               hw:Math.max(Math.abs(x1 - x0)/2, 0.06),
               hd:Math.max(Math.abs(z1 - z0)/2, 0.06),
               ry:BARN_ROT, on:onTheStair });
  }
}

/* ---- the plank walk along the ridge, and the steps up onto it ----
   Nothing stands on the walk any more: the cupola has gone to the far end of
   it, where it is the end of the path rather than a hurdle in the middle. */
{
  const z0 = DECK_Z1, z1 = CUPOLA_Z - 0.65;
  const mid = (z0 + z1)/2, len = z1 - z0;
  const walk = part(BOX(0.92, 0.10, len), PLANK, 0, WALK_Y - 0.05, mid, barn);
  walk.castShadow = walk.receiveShadow = true;
  roofParts.push(walk);
  for(let z = z0 + 0.3; z < z1 - 0.2; z += 0.55){
    roofParts.push(part(BOX(0.96, 0.05, 0.07), PLANK_DARK, 0, WALK_Y + 0.02, z, barn));
  }
  const p = barnToWorld(0, mid);
  addPlatform({ x:p.x, z:p.z, ry:BARN_ROT, hw:0.46, hd:len/2, top:WALK_TOP });

  /* four steps off the deck, up the little gable the front roof ends in */
  const steps = 4, rise = (WALK_Y - DECK_Y)/steps, run = 0.35;
  stair(0, DECK_Z1 - run*steps, 0, steps, rise, run, 0.52, DECK_Y, [], true);
}

/* ============================================================
   The barrels.

   One per variety along the west wall to begin with; the extension frames a
   second row of four behind them and opens the silo beyond that, so a variety
   fills its barrel, then its bay, then the silo. And by the rack there is a
   compost barrel, which is where everything off the ground ends up.
   ============================================================ */
interface Barrel {
  type: AppleType;
  /** the slice of that variety's store this one stands for */
  base: number; cap: number;
  group: THREE.Group;
  fruit: THREE.InstancedMesh;
  lid: THREE.Mesh;
  /** the chalked fill line on the label board */
  gauge: THREE.Mesh;
}
const BARREL_R = 0.48, BARREL_H = 0.86, BARREL_FRUIT = 22;
const barrels: Barrel[] = [];
/** the four the extension adds — built now, hidden until the builders come */
const extraCasks: THREE.Group[] = [];

/** staves, bulging at the waist the way a cooper makes them, and open on top */
function buildCask(lx: number, lz: number, stave: THREE.MeshToonMaterial, head: THREE.Material,
                   y = 0.14, parent: THREE.Object3D = inside){
  const g = new THREE.Group();
  g.position.set(lx, y, lz);
  parent.add(g);

  const staves = stave.clone();
  staves.side = THREE.DoubleSide;
  const wall = new THREE.Mesh(
    new THREE.CylinderGeometry(BARREL_R*0.86, BARREL_R*0.86, BARREL_H, 16, 1, true), staves);
  wall.position.y = BARREL_H/2;
  wall.castShadow = wall.receiveShadow = true;
  g.add(wall);
  addOutline(wall, 1.04, 0x4a3626);
  const waist = new THREE.Mesh(
    new THREE.CylinderGeometry(BARREL_R, BARREL_R, BARREL_H*0.42, 16, 1, true), staves);
  waist.position.y = BARREL_H/2;
  g.add(waist);
  part(CYL(BARREL_R*0.84, BARREL_R*0.84, 0.06, 16), head, 0, 0.05, 0, g);
  for(const y of [0.12, BARREL_H/2, BARREL_H - 0.12]){
    part(new THREE.TorusGeometry(BARREL_R*0.94, 0.028, 5, 20), IRON, 0, y, 0, g).rotation.x = Math.PI/2;
  }
  return g;
}

/** a chalked board naming what goes in, with a line marking how full it is */
function labelBoard(g: THREE.Group, colour: number){
  part(BOX(0.34, 0.46, 0.02), TRIM, 0, BARREL_H*0.52, BARREL_R*0.94, g);
  part(BOX(0.24, 0.045, 0.012), toonMat(colour, true), 0, BARREL_H*0.52 + 0.16, BARREL_R*0.99, g);
  const gauge = part(BOX(0.20, 1, 0.012), toonMat(colour, true), 0, 0, BARREL_R*0.99, g);
  gauge.scale.y = 0.001;
  return gauge;
}

function fruitBarrel(k: AppleType, lx: number, lz: number, base: number, cap: number, extra: boolean){
  const def = APPLE_TYPES[k];
  const g = buildCask(lx, lz, OAK, OAK_DARK);
  const gauge = labelBoard(g, def.color);

  /* what is in it: a cap of apples that climbs as the season fills */
  const fruit = new THREE.InstancedMesh(APPLE_GEO, appleMats[k], BARREL_FRUIT);
  fruit.castShadow = true;
  fruit.count = 0;
  g.add(fruit);

  const lid = part(CYL(BARREL_R*0.80, BARREL_R*0.80, 0.05, 16), OAK_DARK, 0, BARREL_H - 0.02, 0, g);

  const w = barnToWorld(lx, lz);
  addSolid({ kind:'circle', x:w.x, z:w.z, r:BARREL_R + 0.05, top:FLOOR_TOP + BARREL_H,
             on: extra ? () => built('extension') : undefined });

  barrels.push({ type:k, base, cap, group:g, fruit, lid, gauge });
  if(extra) extraCasks.push(g);

  addInteractable({
    id:`barrel-${k}${extra ? '-bay' : ''}`,
    at: new THREE.Vector3(w.x, 0, w.z),
    range: 1.9,
    label: () => {
      if(extra && !built('extension')) return null;
      const have = state.basket[k] + (barrowHandy() ? state.barrow!.load[k] : 0);
      if(!have) return null;
      const name = state.discovered[k] ? def.label : 'this variety';
      if(state.stored[k] >= storeCap())
        return `The ${name} barrel is full to the head`;
      return `Tip ${have} ${have === 1 ? 'apple' : 'apples'} of ${name} into the barrel`;
    },
    use: () => { deposit(k, barrowHandy()); },
  });
}

TYPE_KEYS.forEach((k, i) => {
  fruitBarrel(k, -W/2 + 0.95, -3.2 + i*1.6, 0, CRATE_CAPACITY, false);
  fruitBarrel(k, -W/2 + 2.05, -3.2 + i*1.6, CRATE_CAPACITY, EXTRA_BAY_CAPACITY, true);
});

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(0.125,0.125,0.125);
const _p = new THREE.Vector3();

export function refreshBarrels(){
  for(const b of barrels){
    const have = Math.max(0, Math.min(b.cap, state.stored[b.type] - b.base));
    const frac = have/b.cap;
    const n = have === 0 ? 0 : Math.max(1, Math.round(frac*BARREL_FRUIT));
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
  for(const g of extraCasks) g.visible = built('extension');
  refreshCompost();
}

/* ============================================================
   The compost barrel — outside, against the east wall.

   It stands in the yard rather than in the barn: a heap of rotting windfalls
   is not something you keep next to the fruit you are trying to sell.
   ============================================================ */
const COMPOST_FULL = 60;
const COMPOST_LX = W/2 + 1.15, COMPOST_LZ = 1.0;
const compostAt = barnToWorld(COMPOST_LX, COMPOST_LZ);
const compostGround = groundHeightAt(compostAt.x, compostAt.z);

const compostHeap = (() => {
  const g = buildCask(COMPOST_LX, COMPOST_LZ, OAK_DARK, OAK_DARK,
                      compostGround - BARN_FLOOR_Y, barn);
  const gauge = labelBoard(g, 0x6E5238);
  const heap = part(CYL(BARREL_R*0.80, BARREL_R*0.80, 0.10, 14), toonMat(0x6B4A2C, true),
                    0, 0.30, 0, g);
  heap.visible = false;
  /* a few peelings on top, so it reads as fruit rather than earth */
  const peel: THREE.Mesh[] = [];
  for(let i=0;i<5;i++){
    const a = (i/5)*Math.PI*2;
    const m = part(APPLE_GEO, toonMat(0x8E6B3A, true),
      Math.cos(a)*0.20, 0.34, Math.sin(a)*0.20, g);
    m.scale.set(0.10, 0.055, 0.10);
    m.visible = false;
    peel.push(m);
  }
  const lid = part(CYL(BARREL_R*0.80, BARREL_R*0.80, 0.05, 16), OAK_DARK, 0, BARREL_H - 0.02, 0, g);
  lid.rotation.z = 0.10;
  lid.position.x = 0.10;                       // ajar, and leaning

  addSolid({ kind:'circle', x:compostAt.x, z:compostAt.z,
             r:BARREL_R + 0.05, top:compostGround + BARREL_H });

  addInteractable({
    id:'compost',
    at: new THREE.Vector3(compostAt.x, 0, compostAt.z),
    range: 1.9,
    label: () => state.bruised
      ? `Tip ${state.bruised} ${state.bruised === 1 ? 'windfall' : 'windfalls'} into the compost`
      : (state.composting ? `${state.composting} rotting down — it goes on the rows in the morning` : null),
    use: () => {
      if(!state.bruised) return;
      const n = state.bruised;
      state.composting += n;
      state.bruised = 0;
      renderBasket(); save();
      refreshCompost();
      toast(`${n} ${n === 1 ? 'windfall' : 'windfalls'} into the compost. It goes back on the rows overnight, and the trees set the better for it.`);
    },
  });

  return { heap, peel, gauge, lid };
})();

function refreshCompost(){
  const frac = Math.min(1, state.composting/COMPOST_FULL);
  compostHeap.heap.visible = state.composting > 0;
  compostHeap.heap.position.y = 0.24 + frac*(BARREL_H - 0.42);
  compostHeap.peel.forEach((m, i) => {
    m.visible = state.composting > i*8;
    m.position.y = compostHeap.heap.position.y + 0.05;
  });
  compostHeap.lid.visible = state.composting === 0;
  const h = Math.max(0.004, frac*0.26);
  compostHeap.gauge.scale.y = h;
  compostHeap.gauge.position.y = BARREL_H*0.52 - 0.20 + h/2;
}

refreshBarrels();
on('store:changed', refreshBarrels);
on('upgrade:built', refreshBarrels);

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
    use: () => { deposit(null, barrowHandy()); },
  });
}

/* ============================================================
   The tool rack, on the west wall ahead of the barrels — the east
   wall is the stair now.
   ============================================================ */
{
  const lx = -W/2 + 0.42;
  const board = part(BOX(0.10, 1.5, 3.0), OAK, lx, 1.9, 4.4, inside);
  board.receiveShadow = true;
  for(const lz of [3.4, 4.0, 4.4, 5.0, 5.4]){
    part(CYL(0.035,0.035,0.26,6), OAK_DARK, lx + 0.16, 2.25, lz, inside).rotation.z = Math.PI/2;
  }
  part(BOX(0.06, 0.16, 3.0), OAK_DARK, lx + 0.06, 1.18, 4.4, inside);

  /* where each tool sits when it is hung up, in world space */
  const spots: Record<ToolId, { lx:number; lz:number; y:number; rot:[number,number,number] }> = {
    picker:  { lx: lx + 0.30, lz: 5.40, y: 0.60, rot:[0.16, 0, -0.05] },
    shears:  { lx: lx + 0.24, lz: 4.40, y: 2.10, rot:[0, 0, 0] },
    lantern: { lx: lx + 0.24, lz: 3.40, y: 2.05, rot:[0, 0, 0] },
    ladder:  { lx: lx + 0.55, lz: 6.10, y: 0.16, rot:[0.10, 0, -0.06] },
    barrow:  { lx: -1.5,      lz: 5.30, y: 0.16, rot:[0, Math.PI*0.9, 0] },
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
  const bx = 2.9, bz = -D/2 + 1.0;
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
  const c = part(BOX(0.9, 0.56, 0.66), OAK, W/2 - 1.15, 0.44 + i*0.58, D/2 - 1.5, inside);
  c.rotation.y = (i%2)*0.09 - 0.04;
  c.castShadow = true;
  if(i === 0) addOutline(c, 1.03, 0x4a3626);
}
{
  const w = barnToWorld(W/2 - 1.15, D/2 - 1.5);
  addSolid({ kind:'box', x:w.x, z:w.z, hw:0.48, hd:0.36, ry:BARN_ROT, top:FLOOR_TOP + 1.60 });
}

/* ============================================================
   Light indoors, doors that open, and a roof that gets out of
   the way when you are underneath it
   ============================================================ */
const lampA = new THREE.PointLight(0xFFD9A6, 0, 12, 1.5);
lampA.position.set(0, 2.35, -4.6);                    // under the loft
inside.add(lampA);
const lampB = new THREE.PointLight(0xFFE3C0, 0, 14, 1.5);
lampB.position.set(0, 3.8, 2.6);                      // over the open floor
inside.add(lampB);
const lampC = new THREE.PointLight(0xFFD9A6, 0, 11, 1.5);
lampC.position.set(0, 4.7, -3.6);                     // up in the loft
inside.add(lampC);

/**
 * The roof lifts off while the bear is underneath it. What counts as roof is
 * the list the barn kept as it built — the stairs climb well past the top of
 * the walls, and fading the treads out from under a bear that is standing on
 * them would be a poor way to thank it for the climb.
 */
const roofFade: Fadeable = { mats: [], outlines: [], fade: 1 };
{
  /* the roof shares its paint with the walls below, so it fades on its own
     copies — one per material rather than one per mesh, or the deck alone
     would cost sixty draw calls */
  const clones = new Map<THREE.Material, THREE.Material>();
  for(const mesh of roofParts){
    const mat = mesh.material as THREE.Material;
    let clone = clones.get(mat);
    if(!clone){
      clone = (mat as THREE.MeshToonMaterial).clone();
      clones.set(mat, clone);
      roofFade.mats.push(clone);
    }
    mesh.material = clone;
  }
}

const wallFades: (Fadeable & { nx:number; nz:number })[] = wallPanels.map(w => {
  const clone = (w.mesh.material as THREE.MeshToonMaterial).clone();
  w.mesh.material = clone;
  return { mats:[clone], outlines:[], fade:1, nx:w.nx, nz:w.nz };
});

const _toCam = new THREE.Vector3();
let doorOpen = 0;

export function updateBarnInterior(dt: number, camPos: THREE.Vector3){
  /* under the roof, not on top of it — otherwise walking the roof fades away
     the very boards the bear is standing on. The roof is not one height: it is
     the deck over the back and a gambrel over the front, so ask it. */
  const { x: px, z: pz } = character.position;
  const here = insideBarn(px, pz)
    && character.position.y < BARN_FLOOR_Y + roofOver(px, pz) - 0.35;
  setIndoors(here, character.position.y > LOFT_TOP - 0.4);

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
  lampA.intensity += (warm*1.9 - lampA.intensity)*Math.min(1, dt*3);
  lampB.intensity += (warm*2.2 - lampB.intensity)*Math.min(1, dt*3);
  lampC.intensity += (warm*1.5 - lampC.intensity)*Math.min(1, dt*3);
}

export { insideBarn };
