/* ============================================================
   The silo — boarded up and full of dust until the barn extension
   is built, and after that the farm's bulk store.

   Everything here is barn-local, like the rest of the yard: the silo
   hangs off the barn group, so the barn's own placement and turn are
   already in its transform.
   ============================================================ */
import * as THREE from 'three';
import { BARN_ROT, TYPE_KEYS, CRATE_CAPACITY, EXTRA_BAY_CAPACITY, SILO_CAPACITY,
         UPGRADES } from '../core/config';
import { state, basketTotal, built } from '../core/save';
import { on } from '../core/bus';
import { toonMat, addOutline, part, BOX, CYL } from '../core/materials';
import { addSolid, addPlatform } from './collision';
import { barn, barnToWorld, BARN_FLOOR_Y, SILO_LX, SILO_LZ, DECK_Y, DECK_HALF_W,
         BRIDGE_HALF, upOnTheRoof, STONE, HOOP, ROOF_MAT, TRIM, DECK_PLANK } from './barn';
import { addInteractable } from '../player/interact';
import { startClimb } from '../player/controller';
import { character } from '../player/rig';
import { barrowHandy, barrowTotal } from '../player/picking';
import { deposit, openBarn } from '../ui/overlays';
import { toast } from '../ui/hud';

const BOARD  = toonMat(0x8A6636, true);
const DARK   = toonMat(0x2A2118);
const IRON   = toonMat(0x59606B, true);

const R = 1.5;                    // the shell
/**
 * The silo is built to the barn's own roof deck, so the bridge between them
 * is a level plank walk rather than a scramble. Its height is not a number
 * chosen here; it is whatever the deck turned out to be.
 */
const ROOF_Y = DECK_Y;
const TOP = ROOF_Y - 0.14;        // the shell, under the deck slab
/** the caged ladder runs up the west face, hard against the shell */
const LADDER_X = -(R + 0.12);
/** and puts the bear down here, well inside the parapet */
const STEP_X = -0.85;

const silo = new THREE.Group();
silo.position.set(SILO_LX, 0, SILO_LZ);
barn.add(silo);

/* ---- the shell ---- */
const body = part(CYL(R, R + 0.05, TOP, 20), STONE, 0, TOP/2, 0, silo);
body.castShadow = body.receiveShadow = true;
addOutline(body, 1.02);
for(let i=1;i<7;i++){
  part(new THREE.TorusGeometry(R + 0.03, 0.035, 5, 22), HOOP, 0, i*1.0, 0, silo)
    .rotation.x = Math.PI/2;
}
/* ---- the roof: a flat deck you can stand on, with a parapet and a cap ---- */
{
  const deck = part(CYL(R + 0.10, R + 0.10, 0.14, 20), ROOF_MAT, 0, TOP + 0.07, 0, silo);
  deck.castShadow = deck.receiveShadow = true;
  addOutline(deck, 1.02);
  /* A parapet round the edge — and it holds, rather than being a painted-on
     promise: step off the top rung and a moment of held W would otherwise walk
     the bear straight over the side. The posts are close enough together that
     their collision circles overlap into a continuous ring. */
  const RAIL_R = R + 0.06, POSTS = 10;
  /* one post is missing, and the rail either side of it: that is the gate the
     bridge from the barn comes in through */
  const GATE = 0;
  for(let i=0;i<POSTS;i++){
    if(i === GATE) continue;
    const a = (i/POSTS)*Math.PI*2;
    part(BOX(0.05, 0.62, 0.05), IRON,
      Math.cos(a)*RAIL_R, ROOF_Y + 0.31, Math.sin(a)*RAIL_R, silo);
    const w = barnToWorld(SILO_LX + Math.cos(a)*RAIL_R, SILO_LZ + Math.sin(a)*RAIL_R);
    addSolid({ kind:'circle', x:w.x, z:w.z, r:0.20 });
  }
  /* the rail runs post to post as short straight lengths, so the gate is a
     real gap and not a hoop with a bear-sized hope in it */
  for(let i=0;i<POSTS;i++){
    if(i === GATE || (i + 1) % POSTS === GATE) continue;
    const a0 = (i/POSTS)*Math.PI*2, a1 = ((i+1)/POSTS)*Math.PI*2;
    const x0 = Math.cos(a0)*RAIL_R, z0 = Math.sin(a0)*RAIL_R;
    const x1 = Math.cos(a1)*RAIL_R, z1 = Math.sin(a1)*RAIL_R;
    const seg = part(BOX(0.035, 0.035, Math.hypot(x1-x0, z1-z0)), IRON,
      (x0+x1)/2, ROOF_Y + 0.60, (z0+z1)/2, silo);
    seg.rotation.y = Math.atan2(x1-x0, z1-z0);
  }
  /* the filling cap in the middle, small enough to walk round */
  part(new THREE.SphereGeometry(0.52, 14, 8, 0, Math.PI*2, 0, Math.PI/2), ROOF_MAT, 0, ROOF_Y, 0, silo);
  part(new THREE.TorusGeometry(0.52, 0.03, 5, 14), HOOP, 0, ROOF_Y + 0.02, 0, silo).rotation.x = Math.PI/2;
}

/* ---- the chute door, facing out into the yard ---- */
{
  part(BOX(1.16, 2.00, 0.10), TRIM, 0, 1.00, R - 0.02, silo);
  part(BOX(0.94, 1.76, 0.06), DARK, 0, 0.94, R + 0.05, silo);
  /* a lip at the foot of it, for tipping a basket into */
  part(BOX(1.02, 0.12, 0.34), BOARD, 0, 0.20, R + 0.16, silo).rotation.x = 0.22;
}

/* the boards across it, up until the builders come */
const boards = new THREE.Group();
silo.add(boards);
for(let i=0;i<4;i++){
  const b = part(BOX(1.34, 0.17, 0.05), BOARD, 0, 0.42 + i*0.50, R + 0.09, boards);
  b.rotation.z = (i%2 ? 1 : -1) * 0.045;
}
part(BOX(1.5, 0.14, 0.05), BOARD, 0, 1.15, R + 0.12, boards).rotation.z = 0.62;

/* ---- the chalked level board beside the door ---- */
const levelBoard = part(BOX(0.46, 0.78, 0.03), TRIM, 0.92, 1.85, R - 0.12, silo);
levelBoard.rotation.y = -0.62;
const gauge = part(BOX(0.30, 1, 0.02), toonMat(0xB4713C, true), 0, 0, 0.03, levelBoard);
gauge.scale.y = 0.001;

/* ---- the caged ladder, ground to roof ---- */
{
  for(const sz of [-1, 1]){
    part(BOX(0.06, ROOF_Y + 0.55, 0.06), IRON, LADDER_X, (ROOF_Y + 0.55)/2, sz*0.24, silo);
  }
  for(let y = 0.34; y < ROOF_Y + 0.4; y += 0.34){
    part(BOX(0.06, 0.05, 0.48), IRON, LADDER_X, y, 0, silo);
  }
  /* the hoops of the safety cage, from head height up */
  for(let y = 2.0; y < ROOF_Y - 0.2; y += 0.7){
    const hoop = part(new THREE.TorusGeometry(0.34, 0.022, 4, 12, Math.PI), IRON, LADDER_X - 0.06, y, 0, silo);
    hoop.rotation.set(Math.PI/2, 0, 0);
    hoop.rotation.y = Math.PI/2;
  }
}

/* ============================================================
   The bridge across to the barn.

   Level, because the silo was built to the barn's deck rather than to a
   height of its own — so this is a plank walk between two floors at the same
   height, not a climb. It leaves the deck through the gap in the west railing
   and comes in at the silo's one missing parapet post.
   ============================================================ */
{
  const BX1 = SILO_LX + R + 0.05, BX0 = -DECK_HALF_W - 0.10;
  const cx = (BX0 + BX1)/2, len = BX0 - BX1, z = SILO_LZ;

  const walk = part(BOX(len, 0.10, BRIDGE_HALF*2 - 0.06), DECK_PLANK, cx, DECK_Y - 0.05, z, barn);
  walk.castShadow = walk.receiveShadow = true;
  addOutline(walk, 1.01, 0x4a3626);
  for(let x = BX1 + 0.32; x < BX0 - 0.2; x += 0.48){
    part(BOX(0.07, 0.05, BRIDGE_HALF*2 - 0.12), BOARD, x, DECK_Y + 0.02, z, barn);
  }
  /* two beams under it, so it is carried and not floating */
  for(const sz of [-1, 1]){
    part(BOX(len, 0.14, 0.10), BOARD, cx, DECK_Y - 0.16, z + sz*(BRIDGE_HALF - 0.10), barn);
  }
  /* and rails that hold, seven metres up over the yard */
  for(const sz of [-1, 1]){
    const rz = z + sz*BRIDGE_HALF;
    for(const y of [0.88, 0.48]){
      part(BOX(len, 0.06, 0.06), BOARD, cx, DECK_Y + y, rz, barn);
    }
    for(let i=0;i<=4;i++){
      part(BOX(0.08, 0.94, 0.08), BOARD, BX1 + len*(i/4), DECK_Y + 0.47, rz, barn);
    }
    const r = barnToWorld(cx, rz);
    addSolid({ kind:'box', x:r.x, z:r.z, hw:len/2, hd:0.09, ry:BARN_ROT, on:upOnTheRoof });
  }
  const w = barnToWorld(cx, z);
  addPlatform({ x:w.x, z:w.z, ry:BARN_ROT,
                hw:len/2, hd:BRIDGE_HALF - 0.06, top:BARN_FLOOR_Y + DECK_Y });
}

/* ============================================================
   What it blocks, what it holds you up on, and where you stand
   ============================================================ */
/* The shell blocks the yard, and its own roof is the top of it: give the solid
   a lid and the deck needs no platform of its own — a bear at that height is
   standing on the silo rather than being shoved out of it. */
const wallAt = barnToWorld(SILO_LX, SILO_LZ);
addSolid({ kind:'circle', x:wallAt.x, z:wallAt.z, r:R + 0.15, top:BARN_FLOOR_Y + ROOF_Y });

/** facing the silo from the ladder: the barn's own +x, turned into the world */
const FACE_IN = Math.atan2(Math.cos(BARN_ROT), -Math.sin(BARN_ROT));

const doorAt = barnToWorld(SILO_LX, SILO_LZ + R + 1.0);
const footAt = barnToWorld(SILO_LX + LADDER_X, SILO_LZ);
const roofAt = barnToWorld(SILO_LX + STEP_X, SILO_LZ);

/* ============================================================
   Using it
   ============================================================ */
/** everything the silo can hold, across the four varieties */
export const siloCapacity = () => SILO_CAPACITY * TYPE_KEYS.length;
/** and what is actually down there, once the barrels have taken their share */
export const siloHolds = () => TYPE_KEYS.reduce(
  (n, k) => n + Math.max(0, state.stored[k] - CRATE_CAPACITY - EXTRA_BAY_CAPACITY), 0);

export function refreshSilo(){
  const open = built('extension');
  boards.visible = !open;
  levelBoard.visible = open;
  const frac = open ? Math.min(1, siloHolds()/siloCapacity()) : 0;
  const h = Math.max(0.004, frac*0.56);
  gauge.scale.y = h;
  gauge.position.y = -0.30 + h/2;
}
refreshSilo();
on('store:changed', refreshSilo);
on('upgrade:built', refreshSilo);

/** what is in the paws and in the barrow, and could go down the chute */
const toHand = () => basketTotal() + (barrowHandy() ? barrowTotal() : 0);

addInteractable({
  id:'silo-chute',
  at: new THREE.Vector3(doorAt.x, 0, doorAt.z),
  range: 2.0,
  label: () => {
    /* the door is at the foot of it; a bear on the roof is not at the door */
    if(character.position.y > BARN_FLOOR_Y + 2.0) return null;
    if(!built('extension')) return 'Try the silo door';
    const n = toHand();
    return n ? `Tip all ${n} down the silo chute` : `The silo — ${siloHolds()} apples in it`;
  },
  use: () => {
    if(!built('extension')){
      toast(`Boarded shut, and forty years of chaff in it. The catalogue sells a ${UPGRADES.extension.label.toLowerCase()} that opens it up.`);
      return;
    }
    if(!toHand()){ openBarn('ledger'); return; }
    deposit(null, barrowHandy());
  },
});

addInteractable({
  id:'silo-ladder',
  at: new THREE.Vector3(footAt.x, 0, footAt.z),
  range: 1.6,
  anyAngle: true,
  label: () => character.position.y < BARN_FLOOR_Y + 2.0 ? 'Climb up onto the silo' : null,
  /* up the rungs on the outside, then off onto the deck at the top */
  use: () => startClimb(footAt.x, footAt.z, BARN_FLOOR_Y,
                        BARN_FLOOR_Y + ROOF_Y + 0.22, FACE_IN,
                        roofAt.x, roofAt.z),
});
