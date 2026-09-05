/* ============================================================
   The land — what happens out in the field when a deed arrives.
   The bounds themselves live in config so that everything which clamps or
   draws the edge of the farm can read them without importing the world.
   ============================================================ */
import { PLOTS, bounds, FX1, FX2, FZ2 } from '../core/config';
import type { PlotId } from '../core/config';
import { state } from '../core/save';
import { on } from '../core/bus';
import { rebuildFence, grassPatch } from './props';
import { syncMapExtent } from '../ui/minimap';

/** the strip a plot added, measured from the old fence line to the new one */
function strip(id: PlotId){
  const p = PLOTS[id];
  const { x1, x2, z1, z2 } = bounds;
  if(p.side === 'x1') return { x1: p.to, x2: FX1, z1, z2 };
  if(p.side === 'x2') return { x1: FX2, x2: p.to, z1, z2 };
  return { x1, x2, z1: FZ2, z2: p.to };          // the top field
}

on('land:bought', ({ id }) => {
  const s = strip(id as PlotId);
  rebuildFence();
  grassPatch(Math.min(s.x1, s.x2), Math.max(s.x1, s.x2),
             Math.min(s.z1, s.z2), Math.max(s.z1, s.z2));
  syncMapExtent();
});

/* a season loaded with land already bought needs the same, once */
if(state.plots.length){
  rebuildFence();
  for(const id of state.plots){
    const s = strip(id);
    grassPatch(Math.min(s.x1, s.x2), Math.max(s.x1, s.x2),
               Math.min(s.z1, s.z2), Math.max(s.z1, s.z2));
  }
  syncMapExtent();
}
