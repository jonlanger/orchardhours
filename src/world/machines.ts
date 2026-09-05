/* ============================================================
   The machines — a cider press, a preserving kettle, a drying rack.

   Each is built at start-up and hidden until the post brings it, so nothing
   has to be added to the scene at runtime and its collision box can simply be
   gated on ownership. While a batch is on, each one visibly works: the press
   turns its screw and drips into the pail, the kettle steams over its fire,
   and the rings sway on the rack.
   ============================================================ */
import * as THREE from 'three';
import { BARN_ROT, MACHINES, MACHINE_KEYS } from '../core/config';
import type { MachineId } from '../core/config';
import { state } from '../core/save';
import { on } from '../core/bus';
import { toonMat, addOutline, part, BOX, CYL, SPH } from '../core/materials';
import { addSolid } from './collision';
import { barn, barnToWorld, BARN_FLOOR_Y, FLOOR_TOP } from './barn';
import { addInteractable } from '../player/interact';
import { character } from '../player/rig';
import * as economy from '../core/economy';
import { toast } from '../ui/hud';

const OAK      = toonMat(0xA8763F, true);
const OAK_DARK = toonMat(0x81552A, true);
const IRON     = toonMat(0x59606B, true);
const COPPER   = toonMat(0xB3703A, true);
const BRICK    = toonMat(0x9A5F46, true);
const GLASSY   = toonMat(0xC9506B, true);
const RING     = toonMat(0xE0BE7C, true);
const POMACE   = toonMat(0xC0894A, true);
const JUICE    = toonMat(0xC98A2E, true);
const EMBER    = new THREE.MeshBasicMaterial({ color:0xFF9A3C, transparent:true, opacity:0.9 });
const STEAM    = new THREE.MeshBasicMaterial({ color:0xFFFFFF, transparent:true,
  opacity:0.35, depthWrite:false });

const LOFT_TOP = 2.65 + 0.08;

interface Rig {
  group: THREE.Group;
  busy: THREE.Group;
  /** what it does while a batch is on it */
  tick?: (time: number, dt: number) => void;
}
const rigs = {} as Record<MachineId, Rig>;

/* barn-local, like everything else parented to the barn — see desk.ts */
function bench(id: MachineId, lx: number, lz: number, ly: number){
  const g = new THREE.Group();
  g.position.set(lx, ly, lz);
  barn.add(g);
  const busy = new THREE.Group();
  g.add(busy);
  rigs[id] = { group:g, busy };
  return { g, busy };
}

/* ============================================================
   The cider press — beam, screw, slotted tub, and a pail beneath
   ============================================================ */
{
  const { g, busy } = bench('press', 2.55, -3.05, 0.14);
  const base = part(BOX(0.94, 0.30, 0.94), OAK_DARK, 0, 0.15, 0, g);
  addOutline(base, 1.03, 0x4a3626);
  /* the bed the tub stands on, tilted a touch so the juice runs to the spout */
  part(BOX(0.86, 0.06, 0.86), OAK, 0, 0.33, 0, g);
  const tub = part(CYL(0.38, 0.38, 0.40, 12), OAK, 0, 0.56, 0, g);
  addOutline(tub, 1.04, 0x4a3626);
  for(const y of [0.42, 0.70]){
    part(new THREE.TorusGeometry(0.39, 0.022, 6, 14), IRON, 0, y, 0, g).rotation.x = Math.PI/2;
  }
  /* uprights and the head beam */
  for(const sx of [-1, 1]) part(BOX(0.11, 1.28, 0.11), OAK, sx*0.50, 0.78, 0, g);
  const head = part(BOX(1.22, 0.15, 0.24), OAK, 0, 1.40, 0, g);
  addOutline(head, 1.04, 0x4a3626);

  /* the screw: a shaft with a thread you can see turning */
  const screw = new THREE.Group();
  screw.position.set(0, 1.32, 0);
  g.add(screw);
  part(CYL(0.045, 0.045, 0.66, 8), IRON, 0, -0.33, 0, screw);
  for(let i=0;i<7;i++){
    const t = part(new THREE.TorusGeometry(0.062, 0.015, 5, 10), IRON, 0, -0.06 - i*0.085, 0, screw);
    t.rotation.x = Math.PI/2 + 0.22;
    t.rotation.z = i*0.5;
  }
  part(BOX(0.74, 0.05, 0.05), IRON, 0, 0.04, 0, screw);       // the turning bar
  for(const sx of [-1, 1]) part(SPH, OAK_DARK, sx*0.37, 0.04, 0, screw).scale.setScalar(0.05);

  const platen = part(CYL(0.34, 0.34, 0.09, 12), OAK_DARK, 0, 0.80, 0, g);

  /* the spout, and the pail that catches what comes off it */
  part(CYL(0.028, 0.028, 0.20, 6), OAK_DARK, 0.40, 0.36, 0, g).rotation.z = -Math.PI/2 + 0.25;
  const pail = part(CYL(0.14, 0.11, 0.20, 10), IRON, 0.58, 0.10, 0, g);
  addOutline(pail, 1.05, 0x33231a);

  /* only while it is working: the pomace in the tub, and a drop falling */
  part(CYL(0.32, 0.32, 0.14, 12), POMACE, 0, 0.70, 0, busy);
  const juice = part(CYL(0.115, 0.115, 0.06, 10), JUICE, 0.58, 0.16, 0, busy);
  const drop = part(SPH, JUICE, 0.52, 0.30, 0, busy);
  drop.scale.setScalar(0.028);

  rigs.press.tick = (time) => {
    /* one slow pressing every few seconds: the screw turns, the platen bites */
    const cycle = (time*0.20) % 1;
    const bite = Math.sin(cycle*Math.PI);
    screw.rotation.y = time*1.1;
    platen.position.y = 0.80 - 0.15*bite;
    /* and a drop runs off the spout into the pail */
    const fall = (time*1.6) % 1;
    drop.position.y = 0.30 - fall*0.12;
    drop.visible = bite > 0.15;
    juice.scale.y = 0.6 + bite*0.8;
  };
}

/* ============================================================
   The preserving kettle, on its brick hearth
   ============================================================ */
{
  const { g, busy } = bench('kettle', -3.10, 3.00, 0.14);
  const hearth = part(BOX(0.88, 0.34, 0.74), BRICK, 0, 0.17, 0, g);
  addOutline(hearth, 1.03, 0x4a3626);
  part(BOX(0.66, 0.06, 0.54), IRON, 0, 0.37, 0, g);                   // the trivet
  for(const sx of [-1,1]) part(BOX(0.06, 0.22, 0.06), IRON, sx*0.26, 0.28, 0, g);
  const pot = part(CYL(0.31, 0.24, 0.36, 14), COPPER, 0, 0.58, 0, g);
  addOutline(pot, 1.04, 0x4a3626);
  part(new THREE.TorusGeometry(0.31, 0.024, 6, 16), COPPER, 0, 0.75, 0, g).rotation.x = Math.PI/2;
  const bail = part(new THREE.TorusGeometry(0.27, 0.015, 5, 14, Math.PI), IRON, 0, 0.77, 0, g);
  bail.rotation.y = Math.PI/2;

  /* jars set out to be filled, the fire under it, and steam off the top */
  for(let i=0;i<3;i++){
    part(CYL(0.055, 0.055, 0.13, 8), GLASSY, -0.28 + i*0.14, 0.41, 0.30, busy);
    part(CYL(0.058, 0.058, 0.02, 8), IRON, -0.28 + i*0.14, 0.48, 0.30, busy);
  }
  const fire = new THREE.Group();
  fire.position.set(0, 0.36, 0);
  busy.add(fire);
  for(let i=0;i<4;i++){
    const a = (i/4)*Math.PI*2;
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 5), EMBER);
    flame.position.set(Math.cos(a)*0.07, 0.06, Math.sin(a)*0.07);
    fire.add(flame);
  }
  const puffs: THREE.Mesh[] = [];
  for(let i=0;i<3;i++){
    const puff = new THREE.Mesh(SPH, STEAM.clone());
    puff.position.set(0, 0.8, 0);
    busy.add(puff);
    puffs.push(puff);
  }

  rigs.kettle.tick = (time) => {
    for(let i=0;i<puffs.length;i++){
      const p = ((time*0.45) + i/puffs.length) % 1;
      const puff = puffs[i]!;
      puff.position.set(Math.sin(time*0.9 + i)*0.05, 0.80 + p*0.62, Math.cos(time*0.7 + i)*0.04);
      puff.scale.setScalar(0.05 + p*0.12);
      (puff.material as THREE.MeshBasicMaterial).opacity = 0.34*(1 - p);
    }
    fire.scale.set(1, 0.85 + Math.sin(time*11)*0.15, 1);
    EMBER.opacity = 0.75 + Math.sin(time*13)*0.2;
  };
}

/* ============================================================
   The drying rack, up in the loft where the warm air collects
   ============================================================ */
{
  const { g, busy } = bench('rack', 1.60, -3.40, LOFT_TOP);
  for(const sx of [-1, 1]){
    part(BOX(0.08, 1.22, 0.08), OAK, sx*0.55, 0.61, 0, g);
    part(BOX(0.10, 0.08, 0.70), OAK_DARK, sx*0.55, 0.04, 0, g);
  }
  const bars = [0.52, 0.78, 1.04];
  for(const y of bars) part(BOX(1.18, 0.05, 0.05), OAK_DARK, 0, y, 0, g);

  const rings: THREE.Mesh[] = [];
  for(let r=0;r<bars.length;r++) for(let i=0;i<7;i++){
    const ring = part(new THREE.TorusGeometry(0.045, 0.014, 5, 10), RING,
      -0.48 + i*0.16, bars[r]! - 0.07, 0, busy);
    ring.rotation.y = Math.PI/2;
    rings.push(ring);
  }

  rigs.rack.tick = (time) => {
    /* the draught through the loft moves them, a little out of step */
    for(let i=0;i<rings.length;i++){
      rings[i]!.rotation.z = Math.sin(time*1.3 + i*0.7)*0.22;
    }
    busy.rotation.z = Math.sin(time*0.8)*0.012;
  };
}

/* ---- what you cannot walk through, once it is yours ---- */
const SOLIDS: Record<string, { lx:number; lz:number; hw:number; hd:number; top:number }> = {
  press:  { lx: 2.55, lz:-3.05, hw:0.54, hd:0.52, top: FLOOR_TOP + 0.96 },
  kettle: { lx:-3.10, lz: 3.00, hw:0.47, hd:0.41, top: FLOOR_TOP + 0.34 },
};
for(const [id, s] of Object.entries(SOLIDS)){
  const w = barnToWorld(s.lx, s.lz);
  addSolid({ kind:'box', x:w.x, z:w.z, hw:s.hw, hd:s.hd, ry:BARN_ROT, top:s.top,
    on: () => state.machines.includes(id as MachineId) });
}

/* ---- keeping the meshes honest ---- */
export function refreshMachines(){
  for(const id of MACHINE_KEYS){
    const r = rigs[id];
    if(!r) continue;
    r.group.visible = state.machines.includes(id);
    r.busy.visible = economy.running(id);
  }
}
refreshMachines();

on('machine:installed', ({ id }) => {
  refreshMachines();
  const def = MACHINES[id as MachineId];
  if(def) toast(`The ${def.label} is in the barn. Load it before you turn in.`);
});

/** the working parts, once a frame */
export function updateMachines(dt: number, time: number){
  for(const id of MACHINE_KEYS){
    const r = rigs[id];
    if(!r || !r.group.visible) continue;
    const working = economy.running(id);
    if(r.busy.visible !== working) r.busy.visible = working;
    if(working) r.tick?.(time, dt);
  }
}

/* ---- loading them ---- */
const RACK_POINT = barnToWorld(1.60, -2.70);
for(const id of MACHINE_KEYS){
  const def = MACHINES[id];
  const upstairs = id === 'rack';
  const p = upstairs ? RACK_POINT : barnToWorld(
    id === 'press' ? 2.55 : -2.35, id === 'press' ? -2.30 : 3.00);
  const at = new THREE.Vector3(p.x, BARN_FLOOR_Y + (upstairs ? LOFT_TOP : 0.14), p.z);

  addInteractable({
    id: `machine-${id}`,
    at,
    range: 1.6,
    label: () => {
      if(!state.machines.includes(id)) return null;
      /* the rack is in the loft; only offer it to a bear that has climbed up */
      const up = character.position.y > BARN_FLOOR_Y + 1.5;
      if(upstairs !== up) return null;
      if(economy.running(id)) return `The ${def.label} is working — ready in the morning`;
      return economy.whyNotLoad(id) ?? `Load the ${def.label} — ${def.takes} apples`;
    },
    use: () => {
      if(economy.running(id)) return;
      if(!economy.loadMachine(id)) return;
      refreshMachines();
    },
  });
}
