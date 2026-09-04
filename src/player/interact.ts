/* ============================================================
   Interaction — whatever the bear is standing in front of, and
   the single key that acts on it.
   ============================================================ */
import * as THREE from 'three';
import { pressed } from '../core/input';
import { character } from './rig';
import { setPrompt } from '../ui/hud';

export interface Interactable {
  id: string;
  /** the line to show, or null when this thing has nothing to offer just now */
  label: () => string | null;
  /** where it sits; a function for anything that moves */
  at: THREE.Vector3 | (() => THREE.Vector3);
  range?: number;
  /** must the bear be facing it? most things, yes */
  anyAngle?: boolean;
  use: () => void;
}

const list: Interactable[] = [];
export function addInteractable(i: Interactable){ list.push(i); return i; }
export function removeInteractable(i: Interactable){
  const n = list.indexOf(i);
  if(n >= 0) list.splice(n, 1);
}

let current: Interactable | null = null;
export const nearest = () => current;

const _p = new THREE.Vector3(), _f = new THREE.Vector3();

export function updateInteract(){
  let best: Interactable | null = null;
  let bestScore = Infinity;

  _f.set(Math.sin(character.rotation.y), 0, Math.cos(character.rotation.y));

  for(const i of list){
    const label = i.label();
    if(label === null) continue;
    _p.copy(typeof i.at === 'function' ? i.at() : i.at);
    const dx = _p.x - character.position.x, dz = _p.z - character.position.z;
    const d = Math.hypot(dx, dz);
    const range = i.range ?? 2.2;
    if(d > range) continue;
    /* a small facing bonus, so two things side by side pick the one you face */
    let score = d;
    if(!i.anyAngle && d > 0.2){
      const dot = (dx*_f.x + dz*_f.z)/d;
      if(dot < -0.25) continue;
      score -= dot*0.8;
    }
    if(score < bestScore){ bestScore = score; best = i; }
  }

  current = best;
  setPrompt(best ? best.label() : null);
  if(best && pressed('interact')) best.use();
}

/** fire whatever is in front of the bear — the touch button calls this */
export function useNearest(){ current?.use(); }
