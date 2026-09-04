/* ============================================================
   Applying the comfort/quality toggles
   ============================================================ */
import { renderer, scene } from './renderer';
import { outlines } from './materials';
import { state } from './save';
import { trees, treeData } from '../world/trees';
import { petals } from '../world/props';

export function applySettings(){
  const s = state.settings;
  renderer.shadowMap.enabled = s.shadows;
  scene.traverse(o => {
    const m = (o as { material?: { needsUpdate: boolean } }).material;
    if(m) m.needsUpdate = true;
  });
  outlines.forEach(o => { o.visible = s.outlines; });
  trees.forEach(t => {
    const u = treeData(t);
    u.outlines.forEach(o => { o.visible = s.outlines && u.fade > 0.9; });
  });
  petals.visible = s.petals;
  document.body.classList.toggle('no-map', !s.map);
}
