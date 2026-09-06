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
import { barn, barnToWorld, BARN_FLOOR_Y, SILO_LX, SILO_LZ,
         STONE, HOOP, ROOF_MAT, TRIM } from './barn';
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
const TOP = 7.2;                  // where the dome springs
const DECK_X = -2.2, DECK_Y = 6.55;   // the hatch platform, out on the west side

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
part(new THREE.SphereGeometry(R + 0.06, 20, 10, 0, Math.PI*2, 0, Math.PI/2), ROOF_MAT, 0, TOP, 0, silo);

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

/* ---- the caged ladder up the west side, and the hatch platform ---- */
{
  for(const sz of [-1, 1]){
    part(BOX(0.06, DECK_Y + 0.25, 0.06), IRON, DECK_X, (DECK_Y + 0.25)/2, sz*0.24, silo);
  }
  for(let y = 0.34; y < DECK_Y; y += 0.34){
    part(BOX(0.06, 0.05, 0.48), IRON, DECK_X, y, 0, silo);
  }
  /* brackets back to the shell, so it does not read as floating */
  for(const y of [1.6, 3.6, 5.6]) part(BOX(0.72, 0.06, 0.06), IRON, DECK_X + 0.36, y, 0, silo);

  const deck = part(BOX(1.30, 0.12, 1.30), BOARD, DECK_X, DECK_Y, 0, silo);
  deck.castShadow = deck.receiveShadow = true;
  addOutline(deck, 1.03, 0x4a3626);
  for(const [ox, oz] of [[-0.62, 0], [0, -0.62], [0, 0.62]] as const){
    part(BOX(0.06, 0.72, 0.06), IRON, DECK_X + ox, DECK_Y + 0.42, oz, silo);
    part(BOX(ox ? 0.06 : 1.30, 0.06, ox ? 1.30 : 0.06), IRON, DECK_X + ox, DECK_Y + 0.76, oz, silo);
  }
}

/* ============================================================
   What it blocks, what it holds you up on, and where you stand
   ============================================================ */
const wallAt = barnToWorld(SILO_LX, SILO_LZ);
addSolid({ kind:'circle', x:wallAt.x, z:wallAt.z, r:R + 0.15 });

const deckAt = barnToWorld(SILO_LX + DECK_X, SILO_LZ);
addPlatform({ x:deckAt.x, z:deckAt.z, ry:BARN_ROT, hw:0.65, hd:0.65,
              top:BARN_FLOOR_Y + DECK_Y + 0.06 });

/** facing the silo from the ladder: the barn's own +x, turned into the world */
const FACE_IN = Math.atan2(Math.cos(BARN_ROT), -Math.sin(BARN_ROT));

const doorAt = barnToWorld(SILO_LX, SILO_LZ + R + 1.0);
const footAt = barnToWorld(SILO_LX + DECK_X, SILO_LZ);

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
  range: 1.5,
  anyAngle: true,
  label: () => character.position.y < BARN_FLOOR_Y + 2.0 ? 'Climb the silo ladder' : null,
  use: () => startClimb(footAt.x, footAt.z, BARN_FLOOR_Y,
                        BARN_FLOOR_Y + DECK_Y + 0.06, FACE_IN),
});
