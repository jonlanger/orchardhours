/* ============================================================
   Tools — the pole, the ladder, the barrow, the shears, the lamp.
   A tool is either on the bear or on the rack in the barn; the
   rack is built in world/barnInterior.ts and reads this module.
   ============================================================ */
import * as THREE from 'three';
import { state, save } from '../core/save';
import type { ToolId } from '../core/save';
import { pressed } from '../core/input';
import { scene } from '../core/renderer';
import { toonMat, addOutline, part, BOX, CYL, SPH } from '../core/materials';
import { hour } from '../world/sky';
import { trees, treeData } from '../world/trees';
import { groundHeightAt } from '../world/ground';
import { rig, character } from './rig';
import { addInteractable } from './interact';
import { startClimb, climbing } from './controller';
import { toast } from '../ui/hud';
import { initBelt, renderBelt } from '../ui/belt';

/* ---- materials ---- */
const WOOD      = toonMat(0xB98A50, true);
const WOOD_DARK = toonMat(0x8E6636, true);
const POLE      = toonMat(0xC9A76B, true);
const IRON      = toonMat(0x59606B, true);
const CANVAS_M  = toonMat(0xD9C9A4, true);
const GLASS     = new THREE.MeshStandardMaterial({
  color:0xFFE7B4, emissive:0xFFC46A, emissiveIntensity:1.4, roughness:0.4, transparent:true, opacity:0.85 });

export interface ToolDef {
  id: ToolId;
  label: string;
  slot: number;                 // the number key that reaches for it
  note: string;
  socket: 'handR' | 'shoulder' | 'front';
  pos: [number, number, number];
  rot: [number, number, number];
  build: () => THREE.Group;
  icon: string;
}

/* ---- the meshes ---- */
function buildPicker(){
  const g = new THREE.Group();
  const shaft = part(CYL(0.026, 0.030, 2.9, 8), POLE, 0, 0.85, 0, g);
  addOutline(shaft, 1.10, 0x4a3626);
  part(CYL(0.034, 0.034, 0.10, 8), IRON, 0, 2.24, 0, g);
  /* the wire hoop and its little cloth bag */
  const hoop = part(new THREE.TorusGeometry(0.15, 0.014, 6, 16), IRON, 0, 2.42, 0.02, g);
  hoop.rotation.x = Math.PI/2;
  for(let i=0;i<5;i++){
    const a = (i/5)*Math.PI*2;
    const tine = part(CYL(0.008, 0.008, 0.13, 5), IRON, Math.cos(a)*0.14, 2.47, Math.sin(a)*0.14 + 0.02, g);
    tine.rotation.set(Math.cos(a)*0.35, 0, -Math.sin(a)*0.35);
  }
  const bag = part(new THREE.CylinderGeometry(0.145, 0.09, 0.20, 12, 1, true), CANVAS_M, 0, 2.31, 0.02, g);
  (bag.material as THREE.MeshToonMaterial).side = THREE.DoubleSide;
  part(CYL(0.036, 0.036, 0.16, 8), WOOD_DARK, 0, -0.42, 0, g);   // grip
  return g;
}

const LADDER_H = 3.4;
function buildLadder(){
  const g = new THREE.Group();
  for(const sx of [-1, 1]){
    const rail = part(BOX(0.055, LADDER_H, 0.055), WOOD, sx*0.21, LADDER_H/2, 0, g);
    addOutline(rail, 1.10, 0x4a3626);
  }
  for(let y = 0.28; y < LADDER_H - 0.1; y += 0.34){
    part(BOX(0.46, 0.045, 0.05), WOOD_DARK, 0, y, 0, g);
  }
  return g;
}

function buildBarrow(){
  const g = new THREE.Group();
  const tray = part(BOX(0.62, 0.30, 0.82), WOOD, 0, 0.44, 0.05, g);
  tray.rotation.x = -0.10;
  addOutline(tray, 1.04, 0x4a3626);
  part(BOX(0.66, 0.05, 0.86), WOOD_DARK, 0, 0.29, 0.05, g).rotation.x = -0.10;
  for(const sx of [-1,1]){
    const h = part(BOX(0.05, 0.05, 1.15), WOOD, sx*0.26, 0.40, -0.62, g);
    h.rotation.x = 0.10;
    part(CYL(0.03,0.03,0.16,6), WOOD_DARK, sx*0.26, 0.44, -1.16, g).rotation.x = Math.PI/2;
    part(BOX(0.05, 0.34, 0.05), WOOD_DARK, sx*0.24, 0.16, -0.46, g);
  }
  const wheel = part(CYL(0.20, 0.20, 0.09, 14), IRON, 0, 0.21, 0.62, g);
  wheel.rotation.z = Math.PI/2;
  addOutline(wheel, 1.06, 0x33231a);
  part(BOX(0.06, 0.40, 0.06), WOOD_DARK, 0, 0.34, 0.62, g);
  return g;
}

function buildShears(){
  const g = new THREE.Group();
  for(const sx of [-1,1]){
    const blade = part(BOX(0.022, 0.30, 0.012), IRON, sx*0.014, 0.19, 0, g);
    blade.rotation.z = sx*0.09;
    const grip = part(BOX(0.030, 0.20, 0.022), toonMat(0x8E3A2B), sx*0.030, -0.06, 0, g);
    grip.rotation.z = sx*0.22;
  }
  part(CYL(0.022,0.022,0.030,8), toonMat(0xD9A441), 0, 0.05, 0, g).rotation.x = Math.PI/2;
  return g;
}

let lanternLight: THREE.PointLight;
function buildLantern(){
  const g = new THREE.Group();
  part(CYL(0.075,0.062,0.030,10), IRON, 0, -0.10, 0, g);
  const glass = part(SPH, GLASS, 0, 0.01, 0, g); glass.scale.set(0.062,0.075,0.062);
  for(let i=0;i<4;i++){
    const a = (i/4)*Math.PI*2;
    part(BOX(0.010, 0.19, 0.010), IRON, Math.cos(a)*0.062, 0.01, Math.sin(a)*0.062, g);
  }
  part(CYL(0.062,0.080,0.038,10), IRON, 0, 0.115, 0, g);
  const bail = part(new THREE.TorusGeometry(0.048, 0.008, 5, 12, Math.PI), IRON, 0, 0.135, 0, g);
  bail.rotation.y = Math.PI/2;
  lanternLight = new THREE.PointLight(0xFFC978, 0, 9, 1.6);
  lanternLight.position.y = 0.01;
  g.add(lanternLight);
  return g;
}

export const TOOLS: Record<ToolId, ToolDef> = {
  picker: {
    id:'picker', label:'picking pole', slot:1, socket:'handR', pos:[0,-0.05,0.04], rot:[-0.85,0.12,0.16],
    note:'A telescoping pole with a wire hoop and a cloth bag. Everything above head height comes down with this.',
    build: buildPicker,
    icon:`<svg viewBox="0 0 24 24" fill="none"><path d="M12 21V8" stroke="#8E6636" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="6" r="3.4" stroke="#59606B" stroke-width="1.6"/><path d="M9.2 7.6l1 3h3.6l1-3" stroke="#B9A57C" stroke-width="1.3" stroke-linejoin="round"/></svg>`,
  },
  ladder: {
    id:'ladder', label:'ladder', slot:2, socket:'shoulder', pos:[0.02,0.14,-0.12], rot:[0.15,0.10,1.42],
    note:'Three metres of orchard ladder. Lean it on a trunk and the middle of the tree opens up.',
    build: buildLadder,
    icon:`<svg viewBox="0 0 24 24" fill="none"><path d="M8 3v18M16 3v18" stroke="#B98A50" stroke-width="1.8" stroke-linecap="round"/><path d="M8 7h8M8 12h8M8 17h8" stroke="#8E6636" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  },
  barrow: {
    id:'barrow', label:'wheelbarrow', slot:3, socket:'front', pos:[0,-0.30,0.10], rot:[0,Math.PI,0],
    note:'Sixty apples of overflow, so a good tree does not send you back to the barn halfway through.',
    build: buildBarrow,
    icon:`<svg viewBox="0 0 24 24" fill="none"><path d="M4 8h10l3 6H7L4 8z" stroke="#B98A50" stroke-width="1.6" stroke-linejoin="round"/><path d="M14 14l4 3" stroke="#8E6636" stroke-width="1.6" stroke-linecap="round"/><circle cx="9" cy="18" r="2.2" stroke="#59606B" stroke-width="1.6"/></svg>`,
  },
  shears: {
    id:'shears', label:'pruning shears', slot:4, socket:'handR', pos:[0,-0.02,0.04], rot:[-0.5,0,0.2],
    note:'Winter pruning opens a canopy to the light. A pruned tree sets a heavier crop the next morning.',
    build: buildShears,
    icon:`<svg viewBox="0 0 24 24" fill="none"><path d="M8 3l7 11M16 3L9 14" stroke="#59606B" stroke-width="1.7" stroke-linecap="round"/><circle cx="8" cy="18" r="2.6" stroke="#8E3A2B" stroke-width="1.6"/><circle cx="16" cy="18" r="2.6" stroke="#8E3A2B" stroke-width="1.6"/></svg>`,
  },
  lantern: {
    id:'lantern', label:'lantern', slot:5, socket:'handR', pos:[0,-0.06,0.05], rot:[0,0,0],
    note:'Kerosene, and a wick that wants trimming. It earns its keep once the light goes.',
    build: buildLantern,
    icon:`<svg viewBox="0 0 24 24" fill="none"><path d="M9 4h6M12 4V2" stroke="#59606B" stroke-width="1.5" stroke-linecap="round"/><rect x="7.5" y="6" width="9" height="12" rx="1.6" stroke="#59606B" stroke-width="1.6"/><circle cx="12" cy="12" r="2.6" fill="#FFC46A"/><path d="M6 20h12" stroke="#59606B" stroke-width="1.6" stroke-linecap="round"/></svg>`,
  },
};

export const TOOL_ORDER: ToolId[] = ['picker','ladder','barrow','shears','lantern'];

/* ---- the built meshes, and where they currently live ---- */
const mesh = {} as Record<ToolId, THREE.Group>;
for(const id of TOOL_ORDER){
  const g = TOOLS[id].build();
  g.visible = false;
  scene.add(g);
  mesh[id] = g;
}
export const toolMesh = (id: ToolId) => mesh[id];

export const carrying = (id: ToolId) => state.carried.includes(id);
export const isEquipped = (id: ToolId) => state.equipped === id;

/* the barrow always exists somewhere; the parking square is set by the barn */
export const barrowHome = { x: 0, z: 0, ry: 0 };
export function setBarrowHome(x: number, z: number, ry: number){
  barrowHome.x = x; barrowHome.z = z; barrowHome.ry = ry;
  if(!state.barrow) state.barrow = { x, z, ry, load:{ honeycrisp:0, grannysmith:0, golden:0, rare:0 } };
}

/* where a tool sits when it is not on the bear — the rack fills these in */
export const rackSpot = {} as Record<ToolId, { pos: THREE.Vector3; rot: THREE.Euler }>;
export function setRackSpot(id: ToolId, pos: THREE.Vector3, rot: THREE.Euler){
  rackSpot[id] = { pos, rot };
  place();
}

/* ---- taking, equipping, putting down ---- */
export function take(id: ToolId){
  if(carrying(id)) return;
  state.carried.push(id);
  equip(id);
  save();
}
export function putBack(id: ToolId){
  const n = state.carried.indexOf(id);
  if(n >= 0) state.carried.splice(n, 1);
  if(state.equipped === id) state.equipped = null;
  if(id === 'ladder') state.ladder = null;
  place(); renderBelt(); save();
}
export function equip(id: ToolId){
  if(!carrying(id)) return false;
  state.equipped = state.equipped === id ? null : id;
  place(); renderBelt(); save();
  return true;
}
export function stow(){
  state.equipped = null;
  place(); renderBelt(); save();
}

/** the reach a pole adds, measured from the bear's feet */
export const PICK_BONUS = 3.4;

/* ---- putting every mesh where it belongs ---- */
const _e = new THREE.Euler();
function place(){
  for(const id of TOOL_ORDER){
    const g = mesh[id], def = TOOLS[id];

    if(id === 'ladder' && state.ladder && !carrying('ladder')){
      scene.add(g);
      g.position.set(state.ladder.x, groundHeightAt(state.ladder.x, state.ladder.z), state.ladder.z);
      g.rotation.set(LEAN, state.ladder.ry, 0, 'YXZ');
      g.visible = true;
      continue;
    }
    if(id === 'barrow' && !carrying('barrow')){
      const b = state.barrow;
      scene.add(g);
      if(b){
        g.position.set(b.x, groundHeightAt(b.x, b.z), b.z);
        g.rotation.set(0, b.ry, 0);
      }
      g.visible = true;
      continue;
    }

    if(carrying(id) && (state.equipped === id || def.socket !== 'handR')){
      /* in hand, over the shoulder, or out in front */
      const socket = def.socket === 'handR' ? rig.handR : def.socket === 'shoulder' ? rig.shoulder : rig.front;
      if(state.equipped !== id && def.socket === 'front'){ /* the barrow is only ever pushed */ }
      socket.add(g);
      g.position.set(...def.pos);
      g.rotation.set(...def.rot);
      g.scale.setScalar(1);
      g.visible = true;
      continue;
    }
    if(carrying(id)){
      g.visible = false;                     // in the pack, out of sight
      continue;
    }

    const spot = rackSpot[id];
    if(spot){
      scene.add(g);
      g.position.copy(spot.pos);
      _e.copy(spot.rot);
      g.rotation.copy(_e);
      g.visible = true;
    } else {
      g.visible = false;
    }
  }
}

/** how far off vertical a leaning ladder sits */
const LEAN = -0.22;

/* ---- the ladder out in the rows ---- */
function nearestTree(maxD = 2.8){
  let best: THREE.Group | null = null, bestD = maxD;
  for(const t of trees){
    const d = Math.hypot(t.position.x - character.position.x, t.position.z - character.position.z);
    if(d < bestD){ bestD = d; best = t; }
  }
  return best;
}

function leanLadder(){
  const t = nearestTree();
  if(!t){ toast('Lean it against a tree — stand a little closer to one'); return; }
  /* out from the trunk, on the side the bear is standing */
  const dx = character.position.x - t.position.x, dz = character.position.z - t.position.z;
  const d = Math.hypot(dx, dz) || 1;
  const x = t.position.x + dx/d*0.86, z = t.position.z + dz/d*0.86;
  state.ladder = { x, z, ry: Math.atan2(-dx/d, -dz/d) };
  const n = state.carried.indexOf('ladder');
  if(n >= 0) state.carried.splice(n, 1);
  if(state.equipped === 'ladder') state.equipped = null;
  place(); renderBelt(); save();
  toast('The ladder is set. Stand at the foot of it and press E to climb.');
}

function takeLadder(){
  state.ladder = null;
  if(!carrying('ladder')) state.carried.push('ladder');
  state.equipped = 'ladder';
  place(); renderBelt(); save();
}

const _lp = new THREE.Vector3();
const ladderFoot = () => {
  const l = state.ladder!;
  return _lp.set(l.x - Math.sin(l.ry)*0.55, groundHeightAt(l.x, l.z), l.z - Math.cos(l.ry)*0.55);
};

addInteractable({
  id:'ladder-lean',
  at: () => character.position,
  range: 2.4,
  anyAngle: true,
  label: () => (state.equipped === 'ladder' && nearestTree()) ? 'Lean the ladder against this tree' : null,
  use: leanLadder,
});
addInteractable({
  id:'ladder-climb',
  at: () => state.ladder ? ladderFoot() : character.position,
  range: 1.5,
  anyAngle: true,
  label: () => (state.ladder && !climbing()) ? 'Climb the ladder' : null,
  use: () => {
    const l = state.ladder!;
    startClimb(l.x - Math.sin(l.ry)*0.30, l.z - Math.cos(l.ry)*0.30,
      groundHeightAt(l.x, l.z), groundHeightAt(l.x, l.z) + LADDER_H - 0.55, l.ry);
  },
});

/* ---- the barrow ---- */
export function barrowLoad(){
  const b = state.barrow;
  if(!b) return 0;
  return b.load.honeycrisp + b.load.grannysmith + b.load.golden + b.load.rare;
}

function grabBarrow(){
  if(!state.barrow) return;
  state.carried.push('barrow');
  place(); renderBelt(); save();
  toast('Pushing the barrow. Press 3 to set it down.');
}
function parkBarrow(){
  const n = state.carried.indexOf('barrow');
  if(n >= 0) state.carried.splice(n, 1);
  const p = character.position;
  state.barrow = {
    x: p.x + Math.sin(character.rotation.y)*1.1,
    z: p.z + Math.cos(character.rotation.y)*1.1,
    ry: character.rotation.y,
    load: state.barrow?.load ?? { honeycrisp:0, grannysmith:0, golden:0, rare:0 },
  };
  place(); renderBelt(); save();
}

/* ---- the shears ---- */
function prune(){
  const t = nearestTree(2.6);
  if(!t) return;
  const i = trees.indexOf(t);
  if(state.prunedTrees.includes(i)){ toast('This one is already pruned back.'); return; }
  state.prunedTrees.push(i);
  treeData(t).pruned = true;
  toast('Pruned. It will set a heavier crop by morning.');
  save();
}
addInteractable({
  id:'prune',
  at: () => character.position,
  range: 2.6,
  anyAngle: true,
  label: () => {
    if(state.equipped !== 'shears') return null;
    const t = nearestTree(2.6);
    if(!t) return null;
    return state.prunedTrees.includes(trees.indexOf(t)) ? null : 'Prune this tree';
  },
  use: prune,
});

/* ---- the lantern ---- */
export const lantern = { lit: false };
addInteractable({
  id:'lantern',
  at: () => character.position,
  range: 2.5,
  anyAngle: true,
  label: () => state.equipped === 'lantern' ? (lantern.lit ? 'Put the lantern out' : 'Light the lantern') : null,
  use: () => { lantern.lit = !lantern.lit; },
});

/* ---- reaching for a slot: the number keys and the belt both come here ---- */
export function reachFor(id: ToolId){
  if(id === 'ladder' && state.ladder && !carrying('ladder')){
    const d = Math.hypot(state.ladder.x - character.position.x, state.ladder.z - character.position.z);
    if(d < 2.4){ takeLadder(); toast('Ladder back on the shoulder.'); }
    else toast('The ladder is leaning against a tree over there.');
    return;
  }
  if(id === 'barrow'){
    if(carrying('barrow')){ parkBarrow(); return; }
    const b = state.barrow;
    const d = b ? Math.hypot(b.x - character.position.x, b.z - character.position.z) : Infinity;
    if(d < 2.8){ grabBarrow(); return; }
    toast(b ? 'The barrow is parked elsewhere.' : 'The barrow is in the barn.');
    return;
  }
  if(!carrying(id)){
    toast(`The ${TOOLS[id].label} is on the rack in the barn.`);
    return;
  }
  equip(id);
}

const SLOT_KEYS = ['tool1','tool2','tool3','tool4','tool5'] as const;

export function updateTools(dt: number){
  for(let i=0;i<TOOL_ORDER.length;i++){
    if(pressed(SLOT_KEYS[i]!)) reachFor(TOOL_ORDER[i]!);
  }
  if(pressed('stow') && state.equipped) stow();

  /* the lantern only burns when it is out and lit */
  if(lanternLight){
    const want = (lantern.lit && carrying('lantern')) ? 1.6 + hour.dark*1.6 : 0;
    lanternLight.intensity += (want - lanternLight.intensity)*Math.min(1, dt*4);
    GLASS.emissiveIntensity = lantern.lit ? 1.6 : 0.05;
  }

  /* the barrow rides level over the swells while it is being pushed */
  if(carrying('barrow')){
    const g = mesh.barrow;
    if(g.parent === rig.front){
      const ground = groundHeightAt(character.position.x, character.position.z);
      g.position.y = TOOLS.barrow.pos[1] + (ground - character.position.y);
    }
  }
}

initBelt(
  TOOL_ORDER.map(id => ({
    id, label: TOOLS[id].label, slot: TOOLS[id].slot, icon: TOOLS[id].icon,
    status: () => isEquipped(id) ? 'held' as const
      : (carrying(id) || (id === 'ladder' && state.ladder) || (id === 'barrow' && state.barrow)) ? 'carried' as const
      : 'away' as const,
  })),
  (id) => reachFor(id as ToolId),
);

place();
