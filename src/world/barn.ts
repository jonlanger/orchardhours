/* ============================================================
   The barn — a gambrel roof over the front half, a plank deck
   over the back, a room up there to shelter in, and a yard.
   ============================================================ */
import * as THREE from 'three';
import { BARN_X, BARN_Z, BARN_ROT, BARN_W, BARN_H, BARN_D, TYPE_KEYS, APPLE_TYPES } from '../core/config';
import { scene } from '../core/renderer';
import { toonMat, addOutline, part, BOX, CYL, SPH } from '../core/materials';
import { groundHeightAt } from './ground';
import { APPLE_GEO } from './geometry';
import { addSolid, addPlatform } from './collision';
import { addCameraBlocker } from '../core/cameraRig';
import { character } from '../player/rig';

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
export const DECK_PLANK = toonMat(0xA8834E, true);
const DECK_DARK  = toonMat(0x8A6636, true);
const RAIL_MAT   = toonMat(0x7C5A33, true);
const BEAM_MAT   = toonMat(0x6E5238, true);

const W = BARN_W, H = BARN_H, D = BARN_D;

/* ---- the shell: five panels and a doorway, not a solid block ---- */
export const WALL_T = 0.20;
export const DOOR_HALF = 1.62;          // the gap the sliding doors cover
const SEG = (W/2 - DOOR_HALF)/2;        // half-width of each front segment

export const INSIDE = toonMat(0x9A7A52, true);   // planed timber, seen from within

/* ============================================================
   Barn-local coordinates, and the heights everything upstairs
   is measured from. These are wanted before the roof is raised,
   so they come first.
   ============================================================ */
const _c = Math.cos(BARN_ROT), _s = Math.sin(BARN_ROT);
/** barn-local coordinates out into the world */
export function barnToWorld(lx: number, lz: number){
  return { x: barn.position.x + lx*_c + lz*_s, z: barn.position.z - lx*_s + lz*_c };
}
export const BARN_FLOOR_Y = barn.position.y;
/** the plank floor, a step up off the yard */
export const FLOOR_TOP = BARN_FLOOR_Y + 0.14;

/** the gambrel profile: eave, the knee it breaks at, and the ridge */
const EAVE_X = W/2, KNEE_X = 3.4, KNEE_Y = 2.4, PEAK_Y = 3.6;
/** the ridge of the gambrel, barn-local */
const RIDGE_Y = H + PEAK_Y;
/** the plank walk laid along it */
export const WALK_Y = RIDGE_Y + 0.15;
export const WALK_TOP = BARN_FLOOR_Y + WALK_Y;

/**
 * The roof deck. The back half of the roof is not roofed at all: the two
 * steep lower pitches carry on the length of the barn, and between their
 * knees the back half is decked flat and railed, so it can be stood on.
 */
export const DECK_Y = H + KNEE_Y;                  // the boards you walk on
export const DECK_TOP = BARN_FLOOR_Y + DECK_Y;
export const DECK_HALF_W = KNEE_X;
const DECK_Z0 = -D/2 + WALL_T;
export const DECK_Z1 = -0.10;
/** the stairwell the deck stair comes up through */
const WELL_X0 = -0.85;
/** the mouth the deck stair comes out of, which is also where its rails end */
export const WELL_X1 = 1.65;
/**
 * The stairwell is a notch out of the back edge of the deck rather than an
 * island hole in it. The strip that would otherwise be left between the hole
 * and the parapet is narrower than a bear, so a bear pressed against the
 * parapet would have been standing over the drop.
 */
export const WELL_Z0 = DECK_Z0, WELL_Z1 = DECK_Z0 + 1.20;

/** the hayloft, over the back of the barn and under the deck */
export const LOFT_Y = 2.80;
export const LOFT_SURFACE = LOFT_Y + 0.08;
export const LOFT_TOP = BARN_FLOOR_Y + LOFT_SURFACE;
export const LOFT_D = 5.0;
export const LOFT_Z = -D/2 + WALL_T + LOFT_D/2;

/** anything up on the roof only exists for a bear that is up there with it */
export const upOnTheRoof = () => character.position.y > DECK_TOP - 1.4;

/**
 * Everything that counts as roof, so the barn can lift it off while the
 * bear is underneath. Collected by hand rather than by height: the stairs
 * climb well above the walls and must stay solid, since the bear is
 * standing on them at the time.
 */
export const roofParts: THREE.Mesh[] = [];
function roofPart<T extends THREE.Mesh>(m: T){ roofParts.push(m); return m; }

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
const BATTENS = Math.floor((W/2 - 0.3)/0.95);
for(let i=-BATTENS;i<=BATTENS;i++){
  const b = new THREE.Mesh(BOX(0.09, H*0.98, 0.06), BARN_RED_D);
  b.position.set(i*0.95, H/2, D/2+0.03); barn.add(b);
  const b2 = b.clone(); b2.position.z = -D/2-0.03; barn.add(b2);
}
for(const sx of [-1,1]){
  const t = new THREE.Mesh(BOX(0.10, 0.24, D*1.005), TRIM);
  t.position.set(sx*W/2, H-0.14, 0); barn.add(t);
}

/* ============================================================
   The roof.

   The steep lower pitches run the whole length of the barn — they are what
   makes it a gambrel from the ground. Only the front half carries the shallow
   upper pitches and a ridge; behind them the top is open and decked.
   ============================================================ */
function roofPanel(sx: number, x1: number, y1: number, x2: number, y2: number,
                   over: number, z1: number, z2: number){
  const len = Math.hypot(x2-x1, y2-y1) + over;
  const p = new THREE.Mesh(BOX(len, 0.16, z2 - z1), ROOF_MAT);
  p.position.set(((x1+x2)/2)*sx, H + (y1+y2)/2, (z1+z2)/2);
  p.rotation.z = -Math.atan2(y2-y1, x1-x2) * sx;
  p.castShadow = true; p.receiveShadow = true;
  barn.add(p);
  roofPart(p);
}
/**
 * And the same pitch as something to stand on. Without these the roof is a
 * picture: a bear that steps a hand's breadth off the ridge walk finds nothing
 * under it and drops through the slates onto the barn floor.
 */
function roofSlope(sx: number, x1: number, y1: number, x2: number, y2: number,
                   z1: number, z2: number){
  const cx = sx*(x1 + x2)/2, cz = (z1 + z2)/2;
  const p = barnToWorld(cx, cz);
  addPlatform({
    x:p.x, z:p.z, ry:BARN_ROT,
    hw: Math.abs(x2 - x1)/2, hd: (z2 - z1)/2,
    top: BARN_FLOOR_Y + H + (y1 + y2)/2,
    slopeX: sx*(y2 - y1)/(x2 - x1),
  });
}
const BACK_Z = -D/2 - 0.28, FRONT_Z = D/2 + 0.28;
for(const sx of [1, -1]){
  roofPanel(sx, EAVE_X, 0, KNEE_X, KNEE_Y, 0.42, BACK_Z, FRONT_Z);       // full length
  roofPanel(sx, KNEE_X, KNEE_Y, 0, PEAK_Y, 0.20, DECK_Z1, FRONT_Z);      // front half only
  roofSlope(sx, EAVE_X, 0, KNEE_X, KNEE_Y, BACK_Z, FRONT_Z);
  roofSlope(sx, KNEE_X, KNEE_Y, 0, PEAK_Y, DECK_Z1, FRONT_Z);
}
{
  const ridge = new THREE.Mesh(BOX(0.30, 0.22, FRONT_Z - DECK_Z1), toonMat(0x3F4750));
  ridge.position.set(0, H + PEAK_Y + 0.02, (FRONT_Z + DECK_Z1)/2);
  barn.add(ridge); roofPart(ridge);
}

/* ---- gable ends ---- */
/** the full gambrel, closing the front of the barn */
const gableShape = new THREE.Shape();
gableShape.moveTo(-EAVE_X, 0); gableShape.lineTo(EAVE_X, 0);
gableShape.lineTo(KNEE_X, KNEE_Y); gableShape.lineTo(0, PEAK_Y);
gableShape.lineTo(-KNEE_X, KNEE_Y); gableShape.closePath();
{
  const geo = new THREE.ExtrudeGeometry(gableShape, { depth:0.14, bevelEnabled:false });
  const gm = new THREE.Mesh(geo, BARN_RED);
  gm.position.set(0, H, D/2);
  gm.castShadow = true; barn.add(gm); roofPart(gm);
}
/** the back is cut off at the knees — above that line it is deck, not roof */
{
  const s = new THREE.Shape();
  s.moveTo(-EAVE_X, 0); s.lineTo(EAVE_X, 0);
  s.lineTo(KNEE_X, KNEE_Y + 0.62); s.lineTo(-KNEE_X, KNEE_Y + 0.62); s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth:0.14, bevelEnabled:false });
  const gm = new THREE.Mesh(geo, BARN_RED);
  gm.position.set(0, H, -D/2 - 0.14);
  gm.castShadow = true; barn.add(gm); roofPart(gm);
  /* a coping along the top of the back parapet */
  const cap = part(BOX(KNEE_X*2 + 0.24, 0.12, 0.34), TRIM, 0, H + KNEE_Y + 0.68, -D/2 - 0.06, barn);
  roofPart(cap);
}
/** and where the front roof begins, its own little gable faces the deck */
{
  const s = new THREE.Shape();
  s.moveTo(-KNEE_X, KNEE_Y); s.lineTo(KNEE_X, KNEE_Y); s.lineTo(0, PEAK_Y); s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth:0.16, bevelEnabled:false });
  const gm = new THREE.Mesh(geo, BARN_RED);
  gm.position.set(0, H, DECK_Z1 - 0.02);
  gm.castShadow = true; barn.add(gm); roofPart(gm);
  for(let i=-2;i<=2;i++){
    const b = part(BOX(0.09, 0.9 - Math.abs(i)*0.26, 0.05), BARN_RED_D,
      i*0.62, H + KNEE_Y + (0.9 - Math.abs(i)*0.26)/2, DECK_Z1 - 0.05, barn);
    roofPart(b);
  }
  /* And it holds, either side of the steps that climb over it. The pitch
     behind it rises faster than a bear can step, so without this the front
     edge of the deck was a hole: walk into the gable and you went through it,
     found the roof too high to stand on, and fell into the barn. */
  for(const sx of [-1, 1]){
    const x0 = sx*0.60, x1 = sx*KNEE_X;
    const w = barnToWorld((x0 + x1)/2, DECK_Z1 - 0.05);
    addSolid({ kind:'box', x:w.x, z:w.z, hw:Math.abs(x1 - x0)/2, hd:0.09,
               ry:BARN_ROT, on:upOnTheRoof });
  }
}
/* battens carry on up the front gable */
for(let i=-3;i<=3;i++){
  const b = new THREE.Mesh(BOX(0.09, 2.1, 0.06), BARN_RED_D);
  b.position.set(i*0.95, H + 1.05, D/2+0.16); barn.add(b); roofPart(b);
}

/* ============================================================
   The deck over the back half.

   Laid in four slabs around an open stairwell, so the stair up out of the
   loft comes through a hole in it rather than ending at a closed lid.
   ============================================================ */
const DECK_T = 0.16;
function deckSlab(x0: number, x1: number, z0: number, z1: number){
  const w = x1 - x0, d = z1 - z0, cx = (x0+x1)/2, cz = (z0+z1)/2;
  const m = part(BOX(w, DECK_T, d), DECK_PLANK, cx, DECK_Y - DECK_T/2, cz, barn);
  m.receiveShadow = true;
  roofPart(m);
  /* plank lines, running the length of the barn the way deck boards do */
  for(let x = x0 + 0.34; x < x1 - 0.1; x += 0.34){
    roofPart(part(BOX(0.035, 0.02, d - 0.04), DECK_DARK, x, DECK_Y + 0.005, cz, barn));
  }
  const p = barnToWorld(cx, cz);
  addPlatform({ x:p.x, z:p.z, ry:BARN_ROT, hw:w/2, hd:d/2, top:DECK_TOP });
}
deckSlab(-DECK_HALF_W, DECK_HALF_W, WELL_Z1,  DECK_Z1);
deckSlab(-DECK_HALF_W, WELL_X0,     WELL_Z0,  WELL_Z1);
deckSlab( WELL_X1, DECK_HALF_W,     WELL_Z0,  WELL_Z1);

/* the joists it is laid on, seen from the barn floor below */
for(let z = DECK_Z0 + 0.55; z < DECK_Z1 - 0.2; z += 0.85){
  if(z > WELL_Z0 - 0.4 && z < WELL_Z1 + 0.4) continue;
  roofPart(part(BOX(DECK_HALF_W*2 + 0.3, 0.16, 0.14), BEAM_MAT, 0, DECK_Y - DECK_T - 0.08, z, barn));
}
/* a fascia round the deck's open edges, hiding the joist ends */
for(const sx of [-1, 1]){
  roofPart(part(BOX(0.10, 0.34, DECK_Z1 - DECK_Z0), TRIM,
    sx*(DECK_HALF_W + 0.05), DECK_Y - 0.17, (DECK_Z0 + DECK_Z1)/2, barn));
}
/* A coaming round the stairwell, on the two sides that are deck — the back of
   it is the parapet, and the mouth is where the stair comes out. It holds, and
   only once the bear is up level with the deck: lower than that it would fend
   off the very bear climbing out through it. */
{
  const cz = (WELL_Z0 + WELL_Z1)/2, cx = (WELL_X0 + WELL_X1)/2;
  roofPart(part(BOX(WELL_X1 - WELL_X0 + 0.24, 0.14, 0.12), DECK_DARK,
    cx, DECK_Y + 0.07, WELL_Z1 + 0.06, barn));
  roofPart(part(BOX(0.12, 0.14, WELL_Z1 - WELL_Z0 + 0.24), DECK_DARK,
    WELL_X0 - 0.06, DECK_Y + 0.07, cz, barn));
}

/* ============================================================
   The railing round the deck — a working parapet, not a painted line.
   It has a gap on the west side, where the bridge goes across to the silo.
   ============================================================ */
const RAIL_H = 0.88;
/** where the bridge leaves the deck, in barn-local z */
const BRIDGE_Z = -2.20;
export const BRIDGE_HALF = 0.75;

function railRun(x0: number, z0: number, x1: number, z1: number){
  const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz);
  if(len < 0.2) return;
  const cx = (x0+x1)/2, cz = (z0+z1)/2;
  const ang = Math.atan2(dx, dz);              // a +z-long box, turned to the run
  for(const y of [RAIL_H, RAIL_H*0.54]){
    const r = part(BOX(0.07, 0.08, len), RAIL_MAT, cx, DECK_Y + y, cz, barn);
    r.rotation.y = ang; roofPart(r);
  }
  const n = Math.max(1, Math.round(len/0.92));
  for(let i=0;i<=n;i++){
    const t = i/n;
    const p = part(BOX(0.10, RAIL_H + 0.08, 0.10), RAIL_MAT,
      x0 + dx*t, DECK_Y + (RAIL_H + 0.08)/2, z0 + dz*t, barn);
    p.rotation.y = ang; roofPart(p);
  }
  const w = barnToWorld(cx, cz);
  addSolid({ kind:'box', x:w.x, z:w.z, hw:0.11, hd:len/2, ry:BARN_ROT + ang, on:upOnTheRoof });
}
/* east side, the whole run */
railRun(DECK_HALF_W, DECK_Z0 + 0.1, DECK_HALF_W, DECK_Z1);
/* west side, in two runs with the bridge between them */
railRun(-DECK_HALF_W, DECK_Z0 + 0.1, -DECK_HALF_W, BRIDGE_Z - BRIDGE_HALF);
railRun(-DECK_HALF_W, BRIDGE_Z + BRIDGE_HALF, -DECK_HALF_W, DECK_Z1);
/* The back needs no rail of its own: the truncated gable stands a good half
   metre proud of the boards with a coping along it, which is what a parapet
   is. It holds, and it holds far enough forward that a bear leaning on it is
   not leaning over the stairwell that opens beside it. */
{
  const w = barnToWorld(0, DECK_Z0 - 0.06);
  addSolid({ kind:'box', x:w.x, z:w.z, hw:DECK_HALF_W, hd:0.06, ry:BARN_ROT, on:upOnTheRoof });
}

/* ============================================================
   The roof room — a boarded shed at the back of the deck, open to
   walk into, with a window looking west over the rows.
   ============================================================ */
const SHED_X0 = -3.15, SHED_X1 = -1.10, SHED_Z0 = -6.65, SHED_Z1 = -4.45;
{
  const T = 0.14, HGT = 2.00;
  const cx = (SHED_X0 + SHED_X1)/2, cz = (SHED_Z0 + SHED_Z1)/2;
  const w = SHED_X1 - SHED_X0, d = SHED_Z1 - SHED_Z0;
  const DOOR_X0 = cx - 0.55, DOOR_X1 = cx + 0.55;
  const SHED_RED = toonMat(0x9A5E3E, true);

  function shedWall(x0: number, x1: number, z0: number, z1: number){
    const m = part(BOX(x1-x0, HGT, z1-z0), SHED_RED,
      (x0+x1)/2, DECK_Y + HGT/2, (z0+z1)/2, barn);
    m.receiveShadow = true;
    roofPart(m);
    const p = barnToWorld((x0+x1)/2, (z0+z1)/2);
    addSolid({ kind:'box', x:p.x, z:p.z, hw:(x1-x0)/2, hd:(z1-z0)/2, ry:BARN_ROT, on:upOnTheRoof });
  }
  shedWall(SHED_X0, SHED_X1, SHED_Z0, SHED_Z0 + T);            // back
  shedWall(SHED_X0, SHED_X0 + T, SHED_Z0, SHED_Z1);            // west
  shedWall(SHED_X1 - T, SHED_X1, SHED_Z0, SHED_Z1);            // east
  shedWall(SHED_X0, DOOR_X0, SHED_Z1 - T, SHED_Z1);            // front, left of the door
  shedWall(DOOR_X1, SHED_X1, SHED_Z1 - T, SHED_Z1);            // front, right of the door

  /* a lintel over the doorway */
  roofPart(part(BOX(DOOR_X1 - DOOR_X0 + 0.3, 0.20, T + 0.06), TRIM,
    cx, DECK_Y + HGT - 0.10, SHED_Z1 - T/2, barn));

  /* a shallow gable, ridge running the depth of it */
  const RISE = 0.62, OVER = 0.22;
  for(const sx of [-1, 1]){
    const run = w/2 + OVER;
    const len = Math.hypot(run, RISE) + 0.10;
    const p = part(BOX(len, 0.12, d + OVER*2), ROOF_MAT,
      cx + sx*(run/2), DECK_Y + HGT + RISE/2, cz, barn);
    p.rotation.z = -sx*Math.atan2(RISE, run);
    p.castShadow = true;
    roofPart(p);
  }
  roofPart(part(BOX(0.16, 0.14, d + OVER*2 + 0.06), toonMat(0x3F4750), cx, DECK_Y + HGT + RISE, cz, barn));
  /* the gable triangles at either end */
  {
    const s = new THREE.Shape();
    s.moveTo(-w/2, 0); s.lineTo(w/2, 0); s.lineTo(0, RISE); s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, { depth:0.10, bevelEnabled:false });
    for(const sz of [SHED_Z1 - 0.10, SHED_Z0]){
      const gm = new THREE.Mesh(geo, SHED_RED);
      gm.position.set(cx, DECK_Y + HGT, sz);
      gm.castShadow = true;
      barn.add(gm); roofPart(gm);
    }
  }

  /* a window on the west wall, looking down the rows */
  roofPart(part(BOX(0.08, 0.78, 0.92), TRIM, SHED_X0 + 0.02, DECK_Y + 1.20, cz, barn));
  roofPart(part(BOX(0.05, 0.62, 0.76), toonMat(0x2E3A44), SHED_X0 - 0.01, DECK_Y + 1.20, cz, barn));
  roofPart(part(BOX(0.06, 0.68, 0.06), TRIM, SHED_X0 - 0.02, DECK_Y + 1.20, cz, barn));

  /* and inside it, a bench and a lantern on a hook */
  roofPart(part(BOX(w - T*2 - 0.2, 0.09, 0.44), DECK_PLANK,
    cx, DECK_Y + 0.44, SHED_Z0 + T + 0.26, barn));
  for(const ox of [-0.7, 0.7]){
    roofPart(part(BOX(0.09, 0.44, 0.34), DECK_DARK, cx + ox, DECK_Y + 0.22, SHED_Z0 + T + 0.26, barn));
  }
  /* a hurricane lamp on its hook. It is not a light — a point source in a
     two-metre box washes a hot ring across the boards outside it, and the
     shed is bright enough by day and shut by night */
  roofPart(part(CYL(0.012, 0.012, 0.30, 5), toonMat(0x3B3B43), cx + 0.75, DECK_Y + HGT - 0.30, cz, barn));
  roofPart(part(BOX(0.16, 0.22, 0.16), toonMat(0xE8C878, true), cx + 0.75, DECK_Y + HGT - 0.56, cz, barn));
  roofPart(part(BOX(0.20, 0.05, 0.20), toonMat(0x3B3B43), cx + 0.75, DECK_Y + HGT - 0.43, cz, barn));
}

/* ---- hayloft door + doors + windows on the front (+z) ---- */
part(BOX(1.5, 1.5, 0.10), TRIM, 0, H+1.1, D/2+0.20, barn);
part(BOX(1.3, 1.3, 0.06), toonMat(0x6E4C34, true), 0, H+1.1, D/2+0.25, barn);

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
  part(BOX(0.72, 0.90, 0.10), TRIM, sx*3.6, 2.6, D/2+0.08, barn);
  part(BOX(0.58, 0.76, 0.06), toonMat(0x2E3A44), sx*3.6, 2.6, D/2+0.13, barn);
}

/* ---- cupola + weathervane, at the far end of the ridge walk ----
   It used to stand in the middle of the ridge, where it did nothing but
   block the way past. At the front it is the end of the walk instead. */
export const CUPOLA_Z = D/2 - 0.75;
const cup = new THREE.Group(); cup.position.set(0, RIDGE_Y - 0.02, CUPOLA_Z); barn.add(cup);
part(BOX(0.85,0.85,0.85), TRIM, 0, 0.42, 0, cup);
part(CYL(0.02,0.62,0.55,4), ROOF_MAT, 0, 1.10, 0, cup).rotation.y = Math.PI/4;
part(CYL(0.022,0.022,0.55,6), toonMat(0x3B3B43), 0, 1.62, 0, cup);
part(BOX(0.34,0.20,0.02), toonMat(0x3B3B43), 0.10, 1.88, 0, cup);
part(SPH, BRASS, 0, 1.92, 0, cup).scale.setScalar(0.05);
cup.traverse(o => { if((o as THREE.Mesh).isMesh) roofPart(o as THREE.Mesh); });
{
  const p = barnToWorld(0, CUPOLA_Z);
  addSolid({ kind:'box', x:p.x, z:p.z, hw:0.48, hd:0.48, ry:BARN_ROT,
             on: () => character.position.y > BARN_FLOOR_Y + RIDGE_Y - 1.4 });
}

/* the silo stands off the west wall, square on the bridge that reaches it
   from the deck; world/silo.ts builds both */
export const SILO_LX = -W/2 - 2.4, SILO_LZ = BRIDGE_Z;

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
/* the walls, each as its own slab, so the doorway is genuinely open */
for(const [lx, lz, hw, hd] of [
  [0, -D/2 + WALL_T/2, W/2, WALL_T/2],                       // back
  [-W/2 + WALL_T/2, 0, WALL_T/2, D/2],                       // left
  [ W/2 - WALL_T/2, 0, WALL_T/2, D/2],                       // right
  [-(DOOR_HALF + SEG), D/2 - WALL_T/2, SEG, WALL_T/2],       // front, left of the doors
  [ (DOOR_HALF + SEG), D/2 - WALL_T/2, SEG, WALL_T/2],       // front, right of the doors
] as const){
  const p = barnToWorld(lx, lz);
  /* only as high as the wall itself: the deck and the bridge cross over the
     top of these, and a wall with no ceiling would stop them dead */
  addSolid({ kind:'box', x:p.x, z:p.z, hw, hd, ry:BARN_ROT, ceiling:BARN_FLOOR_Y + H });
}

addPlatform({
  x: barn.position.x, z: barn.position.z, ry: BARN_ROT,
  hw: W/2 - WALL_T, hd: D/2 - WALL_T, top: FLOOR_TOP,
});

const _local = { lx: 0, lz: 0 };
/** a world point back in the barn's own frame */
function barnFromWorld(x: number, z: number){
  const dx = x - barn.position.x, dz = z - barn.position.z;
  /* the inverse of barnToWorld — a turn of +BARN_ROT, not -BARN_ROT */
  _local.lx = dx*_c - dz*_s;
  _local.lz = dx*_s + dz*_c;
  return _local;
}

/** is this point in under the barn roof? */
export function insideBarn(x: number, z: number){
  const l = barnFromWorld(x, z);
  return Math.abs(l.lx) < W/2 && Math.abs(l.lz) < D/2;
}

/**
 * How far above the barn floor the roof is at this point — the gambrel over
 * the front, the deck over the back. Being under it is what indoors means:
 * a flat height would call a bear standing on the pitch, six metres up and
 * out in the weather, indoors, and fade the very slates it stood on.
 */
export function roofOver(x: number, z: number){
  const l = barnFromWorld(x, z);
  const ax = Math.abs(l.lx);
  if(ax >= EAVE_X) return H;
  if(ax >= KNEE_X) return H + KNEE_Y*(EAVE_X - ax)/(EAVE_X - KNEE_X);
  return l.lz < DECK_Z1 ? DECK_Y
                        : H + KNEE_Y + (PEAK_Y - KNEE_Y)*(KNEE_X - ax)/KNEE_X;
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
