/* ============================================================
   The catalogue's arithmetic — what is bought, sold, made and posted.

   Pure rules over `state`: no THREE, no scene, nothing to draw. What the
   world has to do about a delivery goes out on the bus, which is what keeps
   this module importable from anywhere.
   ============================================================ */
import { APPLE_PRICE, GOODS, MACHINES, PLOTS, TYPE_KEYS,
         SAPLING_PRICE, TOO_GOOD_TO_PRESS, applyPlots } from './config';
import type { AppleType, GoodId, MachineId, PlotId } from './config';
import { state, save, storedTotal } from './save';
import { emit } from './bus';
import { toast, renderPurse } from '../ui/hud';

export const purse = () => state.purse;
export const canAfford = (cost: number) => state.purse >= cost;

/** shillings, written the way the catalogue writes them */
export const money = (n: number) => `${n} sh`;

function take(n: number){
  state.purse -= n;
  renderPurse();
}
function earn(n: number){
  state.purse += n;
  state.sold += n;
  renderPurse();
}

/* ============================================================
   Selling — out of the barrels, never out of the basket
   ============================================================ */
export function sellApples(type: AppleType, want: number){
  const n = Math.min(want, state.stored[type]);
  if(n <= 0) return 0;
  const paid = n * APPLE_PRICE[type];
  state.stored[type] -= n;
  earn(paid);
  save();
  return paid;
}

export function sellEveryApple(){
  let paid = 0;
  for(const k of TYPE_KEYS) paid += sellApples(k, state.stored[k]);
  return paid;
}

export function sellGood(good: GoodId, want: number){
  const n = Math.min(want, state.goods[good]);
  if(n <= 0) return 0;
  const paid = n * GOODS[good].price;
  state.goods[good] -= n;
  earn(paid);
  save();
  return paid;
}

/* ============================================================
   Ordering — everything comes with the morning post
   ============================================================ */
const onOrder = (kind: string, id: string) =>
  state.post.some(o => o.kind === kind && o.id === id);

export const machineOwned = (id: MachineId) => state.machines.includes(id);
export const plotOwned    = (id: PlotId) => state.plots.includes(id);
export const machinePending = (id: MachineId) => onOrder('machine', id);
export const plotPending    = (id: PlotId) => onOrder('plot', id);

/** why this cannot be ordered just now, or null when it can */
export function whyNotMachine(id: MachineId){
  if(machineOwned(id)) return 'Already in the barn.';
  if(machinePending(id)) return 'Already in the post.';
  if(!canAfford(MACHINES[id].price)) return 'Not enough in the purse.';
  return null;
}
export function whyNotPlot(id: PlotId){
  if(plotOwned(id)) return 'Already yours.';
  if(plotPending(id)) return 'The deed is in the post.';
  if(!canAfford(PLOTS[id].price)) return 'Not enough in the purse.';
  return null;
}

export function orderMachine(id: MachineId){
  if(whyNotMachine(id)) return false;
  take(MACHINES[id].price);
  state.post.push({ kind:'machine', id, qty:1, due: state.day + 1 });
  save();
  toast(`Ordered: ${MACHINES[id].label}. It comes with the morning post.`);
  return true;
}

export function orderSaplings(qty: number){
  const cost = SAPLING_PRICE * qty;
  if(qty < 1 || !canAfford(cost)) return false;
  take(cost);
  state.post.push({ kind:'sapling', id:'sapling', qty, due: state.day + 1 });
  save();
  toast(qty === 1
    ? 'Ordered: one sapling, bare-rooted. It arrives in the morning.'
    : `Ordered: ${qty} saplings, bare-rooted. They arrive in the morning.`);
  return true;
}

export function orderPlot(id: PlotId){
  if(whyNotPlot(id)) return false;
  take(PLOTS[id].price);
  state.post.push({ kind:'plot', id, qty:1, due: state.day + 1 });
  save();
  toast(`Ordered: ${PLOTS[id].label}. The deed follows in the morning.`);
  return true;
}

/* ============================================================
   Making — a machine takes fruit tonight and gives goods by morning
   ============================================================ */
export const running = (id: MachineId) => state.batches.some(b => b.machine === id);

/** the fruit a machine will eat: the plainest varieties first, never a russet */
export function pressable(){
  return TYPE_KEYS.reduce((n, k) => n + (k === TOO_GOOD_TO_PRESS ? 0 : state.stored[k]), 0);
}

export function whyNotLoad(id: MachineId){
  if(!machineOwned(id)) return null;                 // no machine, no prompt
  if(running(id)) return 'It is already working.';
  const need = MACHINES[id].takes;
  if(pressable() < need) return `It wants ${need} apples in the barrels.`;
  return null;
}

export function loadMachine(id: MachineId){
  if(!machineOwned(id) || running(id)) return false;
  const def = MACHINES[id];
  if(pressable() < def.takes) return false;

  /* cheapest first — the russets stay in the barrel where they are worth more */
  const order = TYPE_KEYS
    .filter(k => k !== TOO_GOOD_TO_PRESS)
    .sort((a, b) => APPLE_PRICE[a] - APPLE_PRICE[b]);
  let left = def.takes;
  for(const k of order){
    const n = Math.min(left, state.stored[k]);
    state.stored[k] -= n;
    left -= n;
    if(!left) break;
  }
  state.batches.push({ machine:id, good:def.good, due: state.day + 1 });
  save();
  toast(`${def.takes} apples into the ${def.label}. It will be ready in the morning.`);
  return true;
}

/* ============================================================
   The morning: the post comes, and last night's work is done
   ============================================================ */
export function overnight(day: number){
  const said: string[] = [];

  const due = state.post.filter(o => o.due <= day);
  state.post = state.post.filter(o => o.due > day);
  for(const o of due){
    if(o.kind === 'machine'){
      const id = o.id as MachineId;
      if(!state.machines.includes(id)) state.machines.push(id);
      emit('machine:installed', { id });
      said.push(`the ${MACHINES[id].label} is in the barn`);
    } else if(o.kind === 'sapling'){
      state.saplings += o.qty;
      said.push(o.qty === 1 ? 'a sapling is by the door' : `${o.qty} saplings are by the door`);
    } else {
      const id = o.id as PlotId;
      if(!state.plots.includes(id)) state.plots.push(id);
      applyPlots(state.plots);
      emit('land:bought', { id });
      said.push(`${PLOTS[id].label} is yours`);
    }
  }

  const done = state.batches.filter(b => b.due <= day);
  state.batches = state.batches.filter(b => b.due > day);
  for(const b of done){
    state.goods[b.good] += MACHINES[b.machine].makes;
    said.push(`the ${MACHINES[b.machine].label} has finished`);
  }

  if(said.length) toast(`The post has come — ${said.join(', ')}.`);
  renderPurse();
  void storedTotal;
}
