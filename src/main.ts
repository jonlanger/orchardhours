/* ============================================================
   ORCHARD HOURS
   A quiet season in the apple rows.
   ============================================================ */
import './style.css';
import * as THREE from 'three';

import { renderer, scene, camera } from './core/renderer';
import { save, state } from './core/save';
import { addPre, addPost, addFixed, addFrame, start, step } from './core/loop';
import * as input from './core/input';
import { applySettings } from './core/settings';

import { updateDay, followCamera, onNewDay } from './world/sky';
import { updateTrees, regrowOvernight, apples, trees } from './world/trees';
import { updateProps } from './world/props';
import * as barn from './world/barn';
import { updateBarnInterior, refreshBarrels } from './world/barnInterior';

import { character, rig } from './player/rig';
import { updateController, player, walkTo, walkToApple, startClimb } from './player/controller';
import { updatePicking, updateBasketFruit, canReach } from './player/picking';
import { initInteraction } from './player/interaction';
import * as interact from './player/interact';
import * as tools from './player/tools';
import { updateCamera, focus, cam, recenterBehind } from './core/cameraRig';

import { renderBasket, setHint, hideHint, hintIsShown, toast, $ } from './ui/hud';
import { initOverlays, openBarn, openMenu, closeOverlays, overlayOpen, deposit } from './ui/overlays';
import { updateMinimap, openMap, closeMap, mapOpen } from './ui/minimap';
import { initTouch } from './ui/touch';

/* ---- boot ---- */
applySettings();
renderBasket();
updateBasketFruit();
initOverlays();
initInteraction();
initTouch();

input.setBlocker(overlayOpen);

/* keys that belong to the shell rather than to the bear */
addEventListener('keydown', e => {
  if(e.key === 'Escape'){ overlayOpen() ? closeOverlays() : openMenu(); }
  if(e.key.toLowerCase() === 'b' && !overlayOpen()) openBarn('almanac');
});

/* ---- systems ---- */
addFixed((dt) => {
  updateController(dt, performance.now()/1000);
  updatePicking(dt);
});

addFrame((dt) => {
  tools.updateTools(dt);
  interact.updateInteract();
  updateMinimap(dt);
});

onNewDay(day => {
  const back = regrowOvernight();
  toast(back
    ? `Day ${day}. The trees have set ${back} more apples overnight.`
    : `Day ${day} in the orchard.`);
});

addFrame((dt, time) => {
  updateDay(dt, character.position);
  updateCamera(dt);
  updateTrees(dt, time, camera.position, focus);
  updateProps(dt, time);
  updateBarnInterior(dt, camera.position);
  followCamera();
});

addPre(() => input.beginFrame());
addPost(() => input.endFrame());

start(() => renderer.render(scene, camera));

/* ---- the opening line, then quiet ---- */
setTimeout(()=>{
  if(hintIsShown()) setHint(input.isTouch
    ? 'Stick to walk · drag to look · tap an apple to pick it'
    : 'WASD to walk · drag to look · tap an apple to pick it');
}, 100);
setTimeout(hideHint, 9000);
/* a nudge toward the barn, for anyone who has not found the rack yet */
setTimeout(()=>{
  if(state.carried.length || overlayOpen()) return;
  setHint('The pole, the ladder and the barrow are on the rack inside the barn');
  setTimeout(hideHint, 8000);
}, 26000);

addEventListener('beforeunload', save);

declare global {
  interface Window { OH: Record<string, unknown> }
}
window.OH = {
  THREE, scene, camera, renderer, state, character, rig, $,
  cam, player, walkTo, walkToApple, startClimb, recenterBehind, openMap, closeMap, mapOpen,
  apples, trees, barn, tools, interact, canReach, refreshBarrels, deposit,
  /** advance the world by hand — used by automated checks */
  step: (s = 1) => step(s, () => renderer.render(scene, camera)),
};
