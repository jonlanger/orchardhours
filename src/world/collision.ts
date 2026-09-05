/* ============================================================
   What the bear cannot walk through, and what it can stand on
   ============================================================ */
import * as THREE from 'three';
import { bounds } from '../core/config';
import { groundHeightAt } from './ground';

export interface Solid {
  kind: 'circle' | 'box';
  x: number; z: number;
  /** circle: radius. box: half-width and half-depth, rotated by ry */
  r?: number; hw?: number; hd?: number; ry?: number;
  /** the height of the walkable surface on top, if there is one */
  top?: number;
  /** the floor it stands on — you are only blocked while below its top */
  base?: number;
  /** turned off while, say, a barn door is open */
  on?: () => boolean;
}

export const solids: Solid[] = [];
export function addSolid(s: Solid){ solids.push(s); return s; }

/** flat surfaces you can land on that block nothing: barn floors, loft decks */
export interface Platform { x: number; z: number; hw: number; hd: number; ry?: number; top: number }
export const platforms: Platform[] = [];
export function addPlatform(p: Platform){ platforms.push(p); return p; }

/** how high a lip the bear steps over without jumping */
export const STEP_UP = 0.42;

const _l = new THREE.Vector2();
function toLocal(x: number, z: number, s: { x:number; z:number; ry?: number }){
  const dx = x - s.x, dz = z - s.z;
  const a = -(s.ry ?? 0);
  _l.set(dx*Math.cos(a) - dz*Math.sin(a), dx*Math.sin(a) + dz*Math.cos(a));
  return _l;
}

function inBox(x: number, z: number, s: { x:number; z:number; ry?: number; hw:number; hd:number }, pad = 0){
  const l = toLocal(x, z, s);
  return Math.abs(l.x) <= s.hw + pad && Math.abs(l.y) <= s.hd + pad;
}

/**
 * The height of whatever the bear would be standing on at (x,z), given that it
 * is currently at height y — a deck only holds you up once you are near its top.
 */
export function surfaceAt(x: number, z: number, y: number){
  let h = groundHeightAt(x, z);
  const ceiling = y + STEP_UP;
  for(const p of platforms){
    if(p.top <= h || p.top > ceiling) continue;
    if(inBox(x, z, { x:p.x, z:p.z, ry:p.ry, hw:p.hw, hd:p.hd })) h = p.top;
  }
  for(const s of solids){
    if(s.top === undefined || s.top <= h || s.top > ceiling) continue;
    if(s.on && !s.on()) continue;
    const hit = s.kind === 'circle'
      ? Math.hypot(x - s.x, z - s.z) <= s.r!
      : inBox(x, z, { x:s.x, z:s.z, ry:s.ry, hw:s.hw!, hd:s.hd! });
    if(hit) h = s.top;
  }
  return h;
}

/**
 * Push a position out of anything solid. Walks the list twice so a bear wedged
 * into a corner settles instead of jittering between two pushes.
 */
export function resolve(p: THREE.Vector3, radius: number){
  for(let pass=0; pass<2; pass++){
    for(const s of solids){
      if(s.on && !s.on()) continue;
      /* standing on top of it, or clear above it? then it is floor, not wall */
      if(s.top !== undefined && p.y >= s.top - 0.08) continue;
      if(s.base !== undefined && p.y > s.base + 4.5) continue;

      if(s.kind === 'circle'){
        const dx = p.x - s.x, dz = p.z - s.z;
        const d = Math.hypot(dx, dz);
        const want = s.r! + radius;
        if(d < want && d > 1e-4){
          p.x = s.x + dx/d*want;
          p.z = s.z + dz/d*want;
        }
      } else {
        const l = toLocal(p.x, p.z, s).clone();
        const hw = s.hw! + radius, hd = s.hd! + radius;
        if(Math.abs(l.x) < hw && Math.abs(l.y) < hd){
          /* out along whichever face is nearest */
          const px = hw - Math.abs(l.x), pz = hd - Math.abs(l.y);
          if(px < pz) l.x = Math.sign(l.x || 1) * hw;
          else        l.y = Math.sign(l.y || 1) * hd;
          const a = s.ry ?? 0;
          p.x = s.x + l.x*Math.cos(a) - l.y*Math.sin(a);
          p.z = s.z + l.x*Math.sin(a) + l.y*Math.cos(a);
        }
      }
    }
  }
  /* the fence, wherever it stands today */
  p.x = Math.max(bounds.x1+1.2, Math.min(bounds.x2-1.2, p.x));
  p.z = Math.max(bounds.z1+1.2, Math.min(bounds.z2-1.2, p.z));
}

/** is this point inside a solid at all? used to place things without burying them */
export function blocked(x: number, z: number, y: number, radius = 0){
  for(const s of solids){
    if(s.on && !s.on()) continue;
    if(s.top !== undefined && y >= s.top - 0.08) continue;
    if(s.kind === 'circle'){
      if(Math.hypot(x - s.x, z - s.z) < s.r! + radius) return true;
    } else if(inBox(x, z, { x:s.x, z:s.z, ry:s.ry, hw:s.hw!, hd:s.hd! }, radius)) return true;
  }
  return false;
}
