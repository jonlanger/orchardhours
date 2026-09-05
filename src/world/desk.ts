/* ============================================================
   The writing desk — where the catalogue is kept, orders are written,
   and fruit is sold. Back-left corner of the barn, under the loft.
   ============================================================ */
import * as THREE from 'three';
import { BARN_ROT } from '../core/config';
import { toonMat, addOutline, part, BOX, CYL } from '../core/materials';
import { emit } from '../core/bus';
import { addSolid } from './collision';
import { barn, barnToWorld, BARN_FLOOR_Y, FLOOR_TOP } from './barn';
import { addInteractable } from '../player/interact';
import { character } from '../player/rig';

const OAK      = toonMat(0xA8763F, true);
const OAK_DARK = toonMat(0x81552A, true);
const LEATHER  = toonMat(0x6A4A33, true);
const PAPER    = toonMat(0xF3E7CC, true);
const INK      = toonMat(0x2E3A36);
const BRASS    = new THREE.MeshStandardMaterial({ color:0xD9A441, roughness:0.35, metalness:0.6 });

/* barn-local: the corner is empty — the chalkboard stops at x -1.6, the
   nearest barrel is at z -2.7, and the loft deck overhead is at 2.65 */
const DESK_X = -2.85, DESK_Z = -4.55;
const TOP_Y = 0.86;

/* parented to the barn, so these are barn-local: the barn's own placement and
   turn are already in its transform. Only solids and prompts want world coords. */
const desk = new THREE.Group();
desk.position.set(DESK_X, 0.14, DESK_Z);
barn.add(desk);

/* the carcass */
const top = part(BOX(1.34, 0.08, 0.62), OAK, 0, TOP_Y, 0, desk);
addOutline(top, 1.03, 0x4a3626);
part(BOX(1.26, 0.30, 0.54), OAK_DARK, 0, TOP_Y - 0.24, -0.02, desk);   // the well under the lid
for(const sx of [-1, 1]) for(const sz of [-1, 1]){
  part(BOX(0.08, TOP_Y - 0.10, 0.08), OAK_DARK, sx*0.58, (TOP_Y - 0.10)/2, sz*0.24, desk);
}
/* a sloped writing lid, hinged at the back */
const lid = part(BOX(1.20, 0.05, 0.48), OAK, 0, TOP_Y + 0.10, 0.02, desk);
lid.rotation.x = -0.18;
addOutline(lid, 1.03, 0x4a3626);
part(BOX(1.20, 0.03, 0.10), LEATHER, 0, TOP_Y + 0.15, -0.18, desk).rotation.x = -0.18;

/* the catalogue itself, open on the lid */
const book = part(BOX(0.40, 0.035, 0.30), PAPER, -0.22, TOP_Y + 0.17, 0.06, desk);
book.rotation.set(-0.18, 0.12, 0);
addOutline(book, 1.05, 0x6b5334);
part(BOX(0.19, 0.008, 0.26), OAK_DARK, -0.22, TOP_Y + 0.19, 0.06, desk).rotation.set(-0.18, 0.12, 0);
/* an ink pot, a pen, and a ledger stack */
part(CYL(0.045, 0.052, 0.07, 8), INK, 0.34, TOP_Y + 0.12, -0.10, desk);
part(CYL(0.006, 0.006, 0.20, 5), PAPER, 0.34, TOP_Y + 0.22, -0.10, desk).rotation.set(0.5, 0, 0.35);
part(BOX(0.28, 0.06, 0.22), PAPER, 0.30, TOP_Y + 0.13, 0.14, desk).rotation.y = -0.15;
part(CYL(0.03, 0.03, 0.02, 8), BRASS, 0.30, TOP_Y + 0.17, 0.14, desk);   // a weight on the papers

/* you cannot walk through it */
{
  const w = barnToWorld(DESK_X, DESK_Z);
  addSolid({ kind:'box', x:w.x, z:w.z, hw:0.70, hd:0.34, ry:BARN_ROT, top: FLOOR_TOP + 0.94 });
}

/** where the bear stands to write — a step out from the desk, into the room */
const _dp = barnToWorld(DESK_X, DESK_Z + 0.95);
export const deskPoint = new THREE.Vector3(_dp.x, BARN_FLOOR_Y + 0.14, _dp.z);

/** close enough to the desk to buy and sell */
export function atDesk(){
  return Math.hypot(character.position.x - deskPoint.x, character.position.z - deskPoint.z) < 2.2
    && character.position.y < BARN_FLOOR_Y + 1.2;
}

addInteractable({
  id:'desk',
  at: deskPoint,
  range: 1.7,
  label: () => 'Open the catalogue',
  use: () => emit('catalogue:open'),
});
