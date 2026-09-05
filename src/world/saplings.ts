/* ============================================================
   Saplings — a bare-rooted whip goes in the ground, thickens over a few
   mornings, and on the fourth is a tree like any other in the rows.
   ============================================================ */
import * as THREE from 'three';
import { SAPLING_STAGES, bounds } from '../core/config';
import { state, save } from '../core/save';
import { scene } from '../core/renderer';
import { toonMat, addOutline, part, CYL } from '../core/materials';
import { groundHeightAt } from './ground';
import { blocked } from './collision';
import { CANOPY_GEOS } from './geometry';
import { trees, plantTree } from './trees';
import { barnDoorPoint, insideBarn } from './barn';
import { addInteractable } from '../player/interact';
import { character } from '../player/rig';
import { toast } from '../ui/hud';

const WHIP  = toonMat(0x8A6544, true);
const LEAFY = toonMat(0x7FA24C, true);

/** how far a new tree must stand from the ones already there */
const SPACING = 4.5;

interface Growing { x: number; z: number; group: THREE.Group }
const growing: Growing[] = [];

/* ---- the model: a whip and up to three tufts, sized by stage ---- */
function buildWhip(){
  const g = new THREE.Group();
  const stem = part(CYL(0.035, 0.055, 1, 6), WHIP, 0, 0.5, 0, g);
  stem.name = 'stem';
  addOutline(stem, 1.10, 0x4a3626);
  for(let i=0;i<3;i++){
    const tuft = new THREE.Mesh(CANOPY_GEOS[i%3]!, LEAFY);
    tuft.name = `tuft${i}`;
    tuft.castShadow = true;
    tuft.visible = false;
    addOutline(tuft, 1.04);
    g.add(tuft);
  }
  return g;
}

/** dress a whip for the stage it has reached: 0 a stick, 3 nearly a tree */
function shape(g: THREE.Group, stage: number){
  const h = 0.55 + stage*0.55;                       // 0.55 → 2.2 m
  const stem = g.getObjectByName('stem') as THREE.Mesh;
  stem.scale.set(0.7 + stage*0.14, h, 0.7 + stage*0.14);
  stem.position.y = h/2;
  for(let i=0;i<3;i++){
    const tuft = g.getObjectByName(`tuft${i}`) as THREE.Mesh;
    tuft.visible = i < stage;
    if(!tuft.visible) continue;
    const a = (i/3)*Math.PI*2 + 0.6;
    const r = 0.16 + stage*0.10;
    const s = 0.20 + stage*0.13;
    tuft.position.set(Math.cos(a)*r, h - 0.10 + (i%2)*0.16, Math.sin(a)*r);
    tuft.scale.set(s*1.2, s*0.9, s*1.2);
  }
}

function place(x: number, z: number, stage: number){
  const g = buildWhip();
  g.position.set(x, groundHeightAt(x, z), z);
  g.rotation.y = Math.random()*Math.PI*2;
  shape(g, stage);
  scene.add(g);
  growing.push({ x, z, group:g });
  return g;
}

/* ---- what has already happened in this season ---- */
for(const p of state.planted) plantTree(p.x, p.z, p.scale);
for(const s of state.growing) place(s.x, s.z, s.stage);

/* ============================================================
   Putting one in the ground
   ============================================================ */
export function canPlantAt(x: number, z: number){
  if(x < bounds.x1 + 2 || x > bounds.x2 - 2) return false;
  if(z < bounds.z1 + 2 || z > bounds.z2 - 2) return false;
  if(insideBarn(x, z)) return false;
  if(Math.hypot(x - barnDoorPoint.x, z - barnDoorPoint.z) < 3) return false;
  for(const t of trees) if(Math.hypot(x - t.position.x, z - t.position.z) < SPACING) return false;
  for(const g of growing) if(Math.hypot(x - g.x, z - g.z) < SPACING) return false;
  if(blocked(x, z, groundHeightAt(x, z) + 0.5, 0.5)) return false;
  return true;
}

/** a step in front of the bear, which is where a planted tree goes */
function spot(){
  return {
    x: character.position.x + Math.sin(character.rotation.y)*1.4,
    z: character.position.z + Math.cos(character.rotation.y)*1.4,
  };
}

addInteractable({
  id:'plant',
  at: () => character.position,
  range: 2.2,
  anyAngle: true,
  label: () => {
    if(!state.saplings) return null;
    const s = spot();
    return canPlantAt(s.x, s.z) ? 'Plant a sapling here' : null;
  },
  use: () => {
    if(!state.saplings) return;
    const s = spot();
    if(!canPlantAt(s.x, s.z)) return;
    state.saplings--;
    state.growing.push({ x:s.x, z:s.z, stage:0 });
    place(s.x, s.z, 0);
    save();
    toast('Planted. Water it with patience — it will bear inside the week.');
  },
});

/* ============================================================
   The morning: everything in the ground comes on a stage
   ============================================================ */
export function overnight(){
  let bearing = 0;
  for(let i = state.growing.length - 1; i >= 0; i--){
    const rec = state.growing[i]!;
    rec.stage++;
    const live = growing.find(g => g.x === rec.x && g.z === rec.z);
    if(rec.stage < SAPLING_STAGES){
      if(live) shape(live.group, rec.stage);
      continue;
    }
    /* grown: the whip comes out and a real tree goes in */
    if(live){
      scene.remove(live.group);
      growing.splice(growing.indexOf(live), 1);
    }
    const scale = 0.88 + Math.random()*0.16;
    plantTree(rec.x, rec.z, scale);
    state.planted.push({ x:rec.x, z:rec.z, scale });
    state.growing.splice(i, 1);
    bearing++;
  }
  if(bearing) toast(bearing === 1
    ? 'One of the young trees is in fruit this morning.'
    : `${bearing} of the young trees are in fruit this morning.`);
}
