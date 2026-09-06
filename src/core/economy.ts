/* ============================================================
   The catalogue's arithmetic — what is bought, sold, made and posted.

   Pure rules over `state`: no THREE, no scene, nothing to draw. What the
   world has to do about a delivery goes out on the bus, which is what keeps
   this module importable from anywhere.
   ============================================================ */
import { APPLE_PRICE, GOODS, MACHINES, PLOTS, UPGRADES, TYPE_KEYS,
         SAPLING_PRICE, TOO_GOOD_TO_PRESS, COMPOST_BOOST, COMPOST_MAX_BOOST,
         applyPlots } from './config';
import type { AppleType, GoodId, MachineId, PlotId, UpgradeId } from './config';
import { state, save, storedTotal, built } from './save';
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
  emit('store:changed');
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
export const upgradeOwned = (id: UpgradeId) => built(id);
export const machinePending = (id: MachineId) => onOrder('machine', id);
export const plotPending    = (id: PlotId) => onOrder('plot', id);
export const upgradePending = (id: UpgradeId) => onOrder('upgrade', id);

/** what is still to be saved up before a price is within reach */
export const shortBy = (cost: number) => Math.max(0, cost - state.purse);
const cannotAfford = (cost: number) => `${money(shortBy(cost))} short of it yet.`;

/** why this cannot be ordered just now, or null when it can */
export function whyNotMachine(id: MachineId){
  if(machineOwned(id)) return 'Already in the barn.';
  if(machinePending(id)) return 'Already in the post.';
  if(!canAfford(MACHINES[id].price)) return cannotAfford(MACHINES[id].price);
  return null;
}
export function whyNotPlot(id: PlotId){
  if(plotOwned(id)) return 'Already yours.';
  if(plotPending(id)) return 'The deed is in the post.';
  if(!canAfford(PLOTS[id].price)) return cannotAfford(PLOTS[id].price);
  return null;
}
export function whyNotUpgrade(id: UpgradeId){
  if(upgradeOwned(id)) return 'Already standing.';
  if(upgradePending(id)) return 'The builders are booked for the morning.';
  if(!canAfford(UPGRADES[id].price)) return cannotAfford(UPGRADES[id].price);
  return null;
}
export function whyNotSaplings(qty: number){
  const cost = SAPLING_PRICE * qty;
  return canAfford(cost) ? null : cannotAfford(cost);
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

export function orderUpgrade(id: UpgradeId){
  if(whyNotUpgrade(id)) return false;
  take(UPGRADES[id].price);
  state.post.push({ kind:'upgrade', id, qty:1, due: state.day + 1 });
  save();
  toast(`Ordered: the ${UPGRADES[id].label.toLowerCase()}. The builders come in the morning.`);
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
   The compost heap — what the windfalls are for
   ============================================================ */
/**
 * Everything in the barrel goes back out onto the rows overnight. Returns the
 * extra chance it buys each tree of setting again by morning.
 */
export function spreadCompost(){
  const n = state.composting;
  if(n <= 0) return 0;
  state.composting = 0;
  state.composted += n;
  save();
  return Math.min(COMPOST_MAX_BOOST, n * COMPOST_BOOST);
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
  emit('store:changed');
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
    } else if(o.kind === 'upgrade'){
      const id = o.id as UpgradeId;
      if(!state.upgrades.includes(id)) state.upgrades.push(id);
      emit('upgrade:built', { id });
      said.push(`the ${UPGRADES[id].label.toLowerCase()} is up`);
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
  emit('store:changed');
  renderPurse();
  void storedTotal;
}
