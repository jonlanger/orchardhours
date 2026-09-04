/* ============================================================
   The frame loop — gameplay on a fixed step, rendering on the frame
   ============================================================ */
import * as THREE from 'three';

export type System = (dt: number, time: number) => void;

const fixedSystems: System[] = [];
const frameSystems: System[] = [];

/** runs on a fixed 1/60 step: movement, physics, anything that must not vary */
export function addFixed(fn: System){ fixedSystems.push(fn); }
/** runs once per rendered frame: cameras, fades, cosmetics */
export function addFrame(fn: System){ frameSystems.push(fn); }

const STEP = 1/60;
const MAX_STEPS = 5;          // after a tab-out, catch up a little and drop the rest

const clock = new THREE.Clock();
let time = 0;
let acc = 0;

export const now = () => time;

/**
 * Advance the world by hand. The browser stops handing out animation frames to
 * a page nobody is looking at, so automated checks drive the clock themselves.
 */
export function step(seconds: number, render?: () => void){
  let left = seconds;
  while(left > 1e-6){
    const dt = Math.min(STEP, left);
    time += dt;
    for(const fn of fixedSystems) fn(dt, time);
    for(const fn of frameSystems) fn(dt, time);
    render?.();
    left -= dt;
  }
}

export function start(render: () => void){
  function frame(){
    requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    time += dt;

    acc += dt;
    let steps = 0;
    while(acc >= STEP && steps < MAX_STEPS){
      for(const fn of fixedSystems) fn(STEP, time);
      acc -= STEP;
      steps++;
    }
    if(steps === MAX_STEPS) acc = 0;

    for(const fn of frameSystems) fn(dt, time);
    render();
  }
  frame();
}
