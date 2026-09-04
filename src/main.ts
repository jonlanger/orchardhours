/* ============================================================
   ORCHARD HOURS
   A quiet season in the apple rows.
   ============================================================ */
import './style.css';
import * as THREE from 'three';

import { renderer, scene, camera } from './core/renderer';
import { load, save, state } from './core/save';
import { addPre, addPost, addFixed, addFrame, start, step } from './core/loop';
import * as input from './core/input';
import { applySettings } from './core/settings';

import { updateDay, followCamera } from './world/sky';
import { updateTrees } from './world/trees';
import { updateProps } from './world/props';
import './world/barn';

import { character, rig } from './player/rig';
import { updateController, player, walkTo } from './player/controller';
import { updatePicking, updateBasketFruit } from './player/picking';
import { initInteraction } from './player/interaction';
import { updateCamera, focus, cam, recenterBehind } from './core/cameraRig';

import { renderBasket, setHint, hideHint, hintIsShown, $ } from './ui/hud';
import { initOverlays, openBarn, openMenu, closeOverlays, overlayOpen } from './ui/overlays';

/* ---- boot ---- */
load();
applySettings();
renderBasket();
updateBasketFruit();
initOverlays();
initInteraction();

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

addFrame((dt, time) => {
  updateDay(dt, character.position);
  updateCamera(dt);
  updateTrees(dt, time, camera.position, focus);
  updateProps(dt, time);
  followCamera();
});

addPre(() => input.beginFrame());
addPost(() => input.endFrame());

start(() => renderer.render(scene, camera));

/* ---- the opening line, then quiet ---- */
setTimeout(()=>{ if(hintIsShown()) setHint('WASD to walk · drag to look · tap an apple to pick it'); }, 100);
setTimeout(hideHint, 9000);

addEventListener('beforeunload', save);

declare global {
  interface Window { OH: Record<string, unknown> }
}
window.OH = {
  THREE, scene, camera, renderer, state, character, rig, $,
  cam, player, walkTo, recenterBehind,
  /** advance the world by hand — used by automated checks */
  step: (s = 1) => step(s, () => renderer.render(scene, camera)),
};
