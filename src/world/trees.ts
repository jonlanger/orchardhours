/* ============================================================
   Trees — trunk, recursive limbs, layered canopy, hung fruit
   ============================================================ */
import * as THREE from 'three';
import { ROWS, PER_ROW, TREE_SPACING, TYPE_WEIGHTS } from '../core/config';
import type { AppleType } from '../core/config';
import { scene } from '../core/renderer';
import { addOutline, orient, fadeGroup } from '../core/materials';
import type { Fadeable } from '../core/materials';
import { state } from '../core/save';
import { groundHeightAt, rowZ } from './ground';
import { addSolid } from './collision';
import {
  BRANCH_GEO, TRUNK_GEO, CANOPY_GEOS, BARK_MAT, BARK_DARK, CANOPY_BASE,
  buildApple, APPLE_SCALE, toonSoft,
} from './geometry';

export interface PickAnim {
  phase: 'reach' | 'fly';
  t: number;
  face?: number;
  from?: THREE.Vector3;
}

export interface Apple {
  group: THREE.Group;
  type: AppleType;
  picked: boolean;
  treeGroup: THREE.Group;
  treeIndex: number;
  standPoint: THREE.Vector3;
  worldPos: THREE.Vector3;
  anim: PickAnim | null;
  sway: number;
  home: THREE.Vector3;
  /** out of arm's reach from the ground — the picker pole exists for these */
  high: boolean;
}

export interface TreeData extends Fadeable {
  canopyY: number;
  canopyR: number;
  pruned: boolean;
}

export const apples: Apple[] = [];
export const trees: THREE.Group[] = [];

export const treeData = (t: THREE.Group) => t.userData as TreeData;

/** fruit a bear can reach standing on the ground */
export const REACH_Y = 3.3;

function pickType(): AppleType {
  const r = Math.random(); let acc = 0;
  for(const [k,w] of TYPE_WEIGHTS){ acc += w; if(r <= acc) return k; }
  return 'honeycrisp';
}

function growLimb(
  group: THREE.Group, origin: THREE.Vector3, dir: THREE.Vector3,
  len: number, rad: number, depth: number,
  tips: { pos: THREE.Vector3; dir: THREE.Vector3 }[],
){
  const m = new THREE.Mesh(BRANCH_GEO, depth > 1 ? BARK_MAT : BARK_DARK);
  m.position.copy(origin);
  orient(m, dir);
  m.scale.set(rad, len, rad);
  m.castShadow = true;
  if(depth >= 2) addOutline(m, 1.14, 0x33231a);
  group.add(m);

  const end = origin.clone().addScaledVector(dir.clone().normalize(), len);
  if(depth <= 0){ tips.push({ pos:end, dir:dir.clone().normalize() }); return; }

  const forks = depth >= 2 ? 2 + (Math.random() < 0.5 ? 1 : 0) : 2;
  for(let i=0;i<forks;i++){
    const axis = new THREE.Vector3(Math.random()-0.5, Math.random()*0.2, Math.random()-0.5).normalize();
    const nd = dir.clone().applyAxisAngle(axis, 0.42 + Math.random()*0.42);
    nd.y = Math.max(nd.y, 0.12);                 // limbs keep reaching upward
    nd.normalize();
    growLimb(group, end, nd, len*(0.66+Math.random()*0.14), rad*0.66, depth-1, tips);
  }
}

function buildTree(x: number, z: number, scale: number, index: number){
  const g = new THREE.Group();
  g.position.set(x, groundHeightAt(x,z), z);
  g.rotation.y = Math.random()*Math.PI*2;

  const trunkH = 3.15*scale;
  const trunk = new THREE.Mesh(TRUNK_GEO, BARK_MAT);
  trunk.scale.set(scale, trunkH, scale);
  trunk.castShadow = true; trunk.receiveShadow = true;
  addOutline(trunk, 1.05, 0x33231a);
  g.add(trunk);

  /* upper scaffolds carry the main canopy */
  const tips: { pos: THREE.Vector3; dir: THREE.Vector3 }[] = [];
  const crotch = new THREE.Vector3(0, trunkH*0.90, 0);
  for(let i=0;i<4;i++){
    const a = (i/4)*Math.PI*2 + Math.random()*0.4;
    const spread = 0.60 + Math.random()*0.30;
    const dir = new THREE.Vector3(Math.cos(a)*spread, 1, Math.sin(a)*spread).normalize();
    growLimb(g, crotch, dir, 1.45*scale, 0.19*scale, 2, tips);
  }

  const hue = (Math.random()-0.5)*0.05;
  const canopyColor = new THREE.Color(CANOPY_BASE).offsetHSL(0, hue, (Math.random()-0.5)*0.06).getHex();
  const canopyMat = new THREE.MeshToonMaterial({ color:canopyColor, gradientMap:toonSoft });
  const canopyDeep = new THREE.MeshToonMaterial({
    color:new THREE.Color(canopyColor).offsetHSL(0.02,0,-0.09).getHex(), gradientMap:toonSoft });

  const core = new THREE.Mesh(CANOPY_GEOS[0]!, canopyDeep);
  core.position.y = trunkH + 2.2*scale;
  core.scale.set(1.95*scale, 1.75*scale, 1.95*scale);
  core.castShadow = true; core.receiveShadow = true;
  addOutline(core, 1.018);
  g.add(core);

  for(const t of tips){
    const b = new THREE.Mesh(CANOPY_GEOS[Math.floor(Math.random()*3)]!, Math.random()<0.5?canopyMat:canopyDeep);
    b.position.copy(t.pos).addScaledVector(t.dir, 0.30*scale);
    const sc = (0.72 + Math.random()*0.36)*scale;
    b.scale.set(sc*1.2, sc*0.92, sc*1.2);
    b.rotation.set(Math.random()*3, Math.random()*3, Math.random()*3);
    b.castShadow = true; b.receiveShadow = true;
    addOutline(b, 1.022);
    g.add(b);
  }

  /* --- low fruiting limbs: what a picker on the ground actually works --- */
  const spots: THREE.Vector3[] = [];
  const nLow = 4 + Math.floor(Math.random()*2);
  for(let i=0;i<nLow;i++){
    const a = (i/nLow)*Math.PI*2 + Math.random()*0.5;
    const len = (1.35 + Math.random()*0.4)*scale;
    const dir = new THREE.Vector3(Math.cos(a), 0.42 + Math.random()*0.2, Math.sin(a)).normalize();
    const base = new THREE.Vector3(0, (1.35 + Math.random()*0.45)*scale, 0);

    const limb = new THREE.Mesh(BRANCH_GEO, BARK_MAT);
    limb.position.copy(base);
    orient(limb, dir);
    limb.scale.set(0.085*scale, len, 0.085*scale);
    limb.castShadow = true;
    addOutline(limb, 1.16, 0x33231a);
    g.add(limb);

    const tip = base.clone().addScaledVector(dir, len);
    // a spur of leaves at the end of the limb
    const leafy = new THREE.Mesh(CANOPY_GEOS[i%3]!, canopyMat);
    leafy.position.copy(tip).add(new THREE.Vector3(0, 0.30*scale, 0));
    const ls = (0.55 + Math.random()*0.20)*scale;
    leafy.scale.set(ls*1.25, ls*0.85, ls*1.25);
    leafy.rotation.set(Math.random()*3, Math.random()*3, Math.random()*3);
    leafy.castShadow = true;
    addOutline(leafy, 1.03);
    g.add(leafy);

    const n = 2 + Math.floor(Math.random()*2);
    for(let j=0;j<n;j++){
      spots.push(new THREE.Vector3(
        tip.x + (Math.random()-0.5)*0.9*scale,
        tip.y - (0.10 + Math.random()*0.35)*scale,
        tip.z + (Math.random()-0.5)*0.9*scale));
    }
  }
  /* --- and the crop up in the canopy, which only a pole will reach --- */
  {
    const nHigh = 4 + Math.floor(Math.random()*3);
    for(let i=0;i<nHigh;i++){
      const a = (i/nHigh)*Math.PI*2 + Math.random()*0.7;
      const rr = core.scale.x*(0.55 + Math.random()*0.42);
      const yy = core.position.y + (Math.random()-0.35)*core.scale.y*1.15;
      spots.push(new THREE.Vector3(Math.cos(a)*rr, Math.max(REACH_Y + 0.45, yy), Math.sin(a)*rr));
    }
  }

  /* plus whatever hangs low off the main canopy's skirt */
  const skirtY = core.position.y - core.scale.y*0.90;
  if(skirtY < 3.4*scale){
    for(let i=0;i<5;i++){
      const a = Math.random()*Math.PI*2, rr = core.scale.x*(0.6+Math.random()*0.25);
      spots.push(new THREE.Vector3(Math.cos(a)*rr, skirtY - Math.random()*0.35, Math.sin(a)*rr));
    }
  }

  const used: THREE.Vector3[] = [];
  for(const p of spots){
    if(p.y < 1.15) continue;
    if(used.some(u => u.distanceTo(p) < 0.48*scale)) continue;
    used.push(p);

    const type = pickType();
    const fruit = buildApple(type);
    fruit.position.copy(p);
    fruit.rotation.y = Math.random()*Math.PI*2;
    g.add(fruit);

    const twig = new THREE.Mesh(BRANCH_GEO, BARK_DARK);
    twig.position.copy(p).add(new THREE.Vector3(0, 0.12, 0));
    orient(twig, new THREE.Vector3((Math.random()-0.5)*0.5, 1, (Math.random()-0.5)*0.5));
    twig.scale.set(0.020*scale, 0.26*scale, 0.020*scale);
    g.add(twig);

    apples.push({
      group: fruit, type, picked:false, treeGroup:g, treeIndex:index,
      standPoint: new THREE.Vector3(), worldPos: new THREE.Vector3(),
      anim:null, sway:Math.random()*Math.PI*2, home:p.clone(),
      high: p.y > REACH_Y,
    });
  }

  // everything the fade-out needs: the leaf materials, the ink hulls, and the canopy height
  const treeOutlines: THREE.Object3D[] = [];
  g.traverse(o => {
    const m = (o as THREE.Mesh).material as THREE.Material | undefined;
    if((o as THREE.Mesh).isMesh && m && m.side === THREE.BackSide) treeOutlines.push(o);
  });
  const data: TreeData = {
    mats:[canopyMat, canopyDeep], outlines:treeOutlines,
    canopyY:core.position.y, canopyR:core.scale.x*1.55, fade:1,
    pruned: state.prunedTrees.includes(index),
  };
  g.userData = data;

  scene.add(g);
  trees.push(g);
  return g;
}

/* --- plant the rows --- */
let planted = 0;
for(let r=0;r<ROWS;r++){
  for(let i=0;i<PER_ROW;i++){
    const x = (i - (PER_ROW-1)/2) * TREE_SPACING + (Math.random()-0.5)*0.5;
    const z = rowZ[r]! + (Math.random()-0.5)*0.5;
    buildTree(x, z, 0.95 + Math.random()*0.25, planted++);
  }
}

/* trunks are the one thing in the rows you cannot walk through */
for(const t of trees) addSolid({ kind:'circle', x:t.position.x, z:t.position.z, r:0.5 });

/* stand points: where the bear plants its feet to reach each apple */
scene.updateMatrixWorld(true);
{
  const wp = new THREE.Vector3();
  for(const a of apples){
    a.group.getWorldPosition(wp);
    const tp = a.treeGroup.position;
    const flat = new THREE.Vector3(wp.x - tp.x, 0, wp.z - tp.z);
    if(flat.lengthSq() < 1e-4) flat.set(1,0,0);
    flat.normalize().multiplyScalar(a.high ? 1.55 : 0.85);
    const sx = tp.x + flat.x + (wp.x - tp.x)*0.55;
    const sz = tp.z + flat.z + (wp.z - tp.z)*0.55;
    a.standPoint.set(sx, groundHeightAt(sx,sz), sz);
    a.worldPos.copy(wp);
  }
}

/* ---- per-frame: sway, and fading whatever stands between eye and bear ---- */
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _camDir = new THREE.Vector3();

export function updateTrees(dt: number, time: number, camPos: THREE.Vector3, focus: THREE.Vector3){
  const windScale = state.settings.calm ? 0.45 : 1;

  for(const a of apples){
    if(a.picked || a.anim) continue;
    const s = Math.sin(time*1.6 + a.sway);
    a.group.position.y = a.home.y + s*0.018*windScale;
    a.group.rotation.z = s*0.10*windScale;
  }

  _camDir.subVectors(focus, camPos);
  const camLen = _camDir.length();
  _camDir.divideScalar(camLen || 1);

  for(let i=0;i<trees.length;i++){
    const t = trees[i]!;
    t.rotation.z = Math.sin(time*0.55 + i*1.3)*0.006*windScale;
    t.rotation.x = Math.cos(time*0.47 + i*0.9)*0.005*windScale;

    const u = treeData(t);
    _v1.set(t.position.x, t.position.y + u.canopyY, t.position.z).sub(camPos);
    const along = _v1.dot(_camDir);
    let blocking = false;
    if(_v1.length() < u.canopyR + 2.2){
      blocking = true;                                   // camera is in among the leaves
    } else if(along > 0.4 && along < camLen - 0.8){
      const perp = _v2.copy(_camDir).multiplyScalar(along).sub(_v1).length();
      blocking = perp < u.canopyR + 1.1;
    }
    fadeGroup(u, blocking ? 0.16 : 1, dt, state.settings.outlines);
  }
}

/**
 * Overnight the trees set again. A pruned tree, opened to the light, brings
 * back most of what came off it; an unpruned one only some.
 */
export function regrowOvernight(){
  let back = 0;
  for(const a of apples){
    if(!a.picked || a.anim) continue;
    const chance = treeData(a.treeGroup).pruned ? 0.75 : 0.30;
    if(Math.random() > chance) continue;
    a.picked = false;
    a.group.visible = true;
    a.group.scale.setScalar(APPLE_SCALE);
    a.group.position.copy(a.home);
    back++;
  }
  return back;
}

/** put every picked apple back on the branch */
export function regrowAll(){
  for(const a of apples){
    if(!a.picked) continue;
    a.picked = false;
    a.anim = null;
    a.group.visible = true;
    a.group.scale.setScalar(APPLE_SCALE);
    a.group.position.copy(a.home);
  }
}
