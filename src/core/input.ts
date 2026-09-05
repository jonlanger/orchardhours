/* ============================================================
   Input — one place for the keyboard, the pointer, and the
   tap-versus-drag question that decides whether a gesture was
   aimed at the world or at the camera.
   ============================================================ */
import * as THREE from 'three';
import { renderer } from './renderer';

export type Action =
  | 'jump' | 'run' | 'interact' | 'stow'
  | 'map' | 'menu' | 'barn'
  | 'eat' | 'sit' | 'throw'
  | 'tool1' | 'tool2' | 'tool3' | 'tool4' | 'tool5';

const BINDINGS: Record<Action, string[]> = {
  jump:     ['Space'],
  run:      ['ShiftLeft', 'ShiftRight'],
  interact: ['KeyE', 'Enter'],
  stow:     ['KeyX'],
  map:      ['KeyM'],
  menu:     ['Escape'],
  barn:     ['KeyB'],
  eat:      ['KeyF'],
  sit:      ['KeyC'],
  throw:    ['KeyR'],
  tool1:    ['Digit1'], tool2: ['Digit2'], tool3: ['Digit3'],
  tool4:    ['Digit4'], tool5: ['Digit5'],
};

const down = new Set<string>();
const justDown = new Set<string>();

/** movement intent in camera space: x = strafe, y = forward */
export const move = new THREE.Vector2();
/** camera intent from the arrow keys: x = yaw, y = pitch */
export const look = new THREE.Vector2();

/** drag/zoom accumulated since the last frame; the camera rig drains these */
export const pointerDelta = { x:0, y:0, zoom:0, pan:false };
export let dragging = false;

/** true while the pointer is coarse — the touch HUD keys off this */
export const isTouch = matchMedia('(pointer: coarse)').matches;

export function held(a: Action){ return BINDINGS[a].some(c => down.has(c)); }
export function pressed(a: Action){ return BINDINGS[a].some(c => justDown.has(c)); }

/** anything on screen that swallows input while it is open */
let blocked: () => boolean = () => false;
export function setBlocker(fn: () => boolean){ blocked = fn; }

type TapHandler = (x: number, y: number) => void;
const tapHandlers: TapHandler[] = [];
export function onTap(fn: TapHandler){ tapHandlers.push(fn); }

/* ---- keyboard ---- */
addEventListener('keydown', e => {
  if(e.repeat) return;
  const el = document.activeElement;
  if(el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;
  down.add(e.code);
  justDown.add(e.code);
  if(e.code === 'Space') e.preventDefault();
});
addEventListener('keyup', e => down.delete(e.code));
addEventListener('blur', ()=> { down.clear(); pointers.clear(); dragging = false; });

/* ---- pointer: one finger orbits, two fingers pinch, a quick tap is a tap ---- */
interface Track { x:number; y:number; startX:number; startY:number; t:number; moved:number; }
const pointers = new Map<number, Track>();
const TAP_SLOP = 8;      // px of travel still counted as a tap
const TAP_TIME = 300;    // ms
let pinchDist = 0;

const canvas = renderer.domElement;

canvas.addEventListener('pointerdown', e => {
  if(blocked()) return;
  pointers.set(e.pointerId, {
    x:e.clientX, y:e.clientY, startX:e.clientX, startY:e.clientY, t:performance.now(), moved:0,
  });
  if(pointers.size === 2) pinchDist = twoFingerDistance();
  canvas.setPointerCapture?.(e.pointerId);
});

canvas.addEventListener('pointermove', e => {
  const p = pointers.get(e.pointerId);
  if(!p) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y;
  p.x = e.clientX; p.y = e.clientY;
  p.moved += Math.hypot(dx, dy);

  if(pointers.size >= 2){
    const d = twoFingerDistance();
    pointerDelta.zoom += (pinchDist - d) * 0.02;
    pinchDist = d;
    dragging = true;
    return;
  }
  if(p.moved > TAP_SLOP){
    dragging = true;
    pointerDelta.x += dx;
    pointerDelta.y += dy;
    /* middle button or shift drags the frame sideways instead of orbiting */
    pointerDelta.pan = e.buttons === 4 || e.shiftKey;
  }
});

function endPointer(e: PointerEvent){
  const p = pointers.get(e.pointerId);
  pointers.delete(e.pointerId);
  if(pointers.size < 2) pinchDist = 0;
  if(pointers.size === 0) dragging = false;
  if(!p || blocked()) return;
  const quick = performance.now() - p.t < TAP_TIME;
  const still = Math.hypot(e.clientX - p.startX, e.clientY - p.startY) <= TAP_SLOP && p.moved <= TAP_SLOP*2;
  if(quick && still) for(const fn of tapHandlers) fn(e.clientX, e.clientY);
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', e => { pointers.delete(e.pointerId); dragging = pointers.size > 0; });

function twoFingerDistance(){
  const [a, b] = [...pointers.values()];
  return Math.hypot(a.x - b.x, a.y - b.y);
}

canvas.addEventListener('wheel', e => {
  if(blocked()) return;
  e.preventDefault();
  pointerDelta.zoom += Math.sign(e.deltaY) * 0.6;
}, { passive:false });

canvas.addEventListener('contextmenu', e => e.preventDefault());

/* ---- virtual stick, filled in by the touch HUD ---- */
export const stick = new THREE.Vector2();

/**
 * Roll the per-frame edges and axes forward. Registered last in the frame so
 * every consumer has already seen this frame's presses.
 */
export function endFrame(){
  justDown.clear();
  pointerDelta.x = pointerDelta.y = pointerDelta.zoom = 0;
  pointerDelta.pan = false;
}

/** recompute the analogue axes; runs before the systems that read them */
export function beginFrame(){
  if(blocked()){ move.set(0,0); look.set(0,0); return; }
  move.set(
    (down.has('KeyD') ? 1 : 0) - (down.has('KeyA') ? 1 : 0),
    (down.has('KeyW') ? 1 : 0) - (down.has('KeyS') ? 1 : 0),
  );
  if(stick.lengthSq() > 0.02) move.copy(stick);
  if(move.lengthSq() > 1) move.normalize();
  look.set(
    (down.has('ArrowRight') ? 1 : 0) - (down.has('ArrowLeft') ? 1 : 0),
    (down.has('ArrowDown')  ? 1 : 0) - (down.has('ArrowUp')   ? 1 : 0),
  );
}
