/* ============================================================
   Game state, and the versioned save behind it
   ============================================================ */
import type { AppleType, GoodId, MachineId, PlotId, UpgradeId } from './config';
import { TYPE_KEYS, GOOD_KEYS, MACHINE_KEYS, PLOT_KEYS, UPGRADE_KEYS, SAPLING_STAGES,
         CRATE_CAPACITY, EXTRA_BAY_CAPACITY, SILO_CAPACITY, applyPlots } from './config';

export type ToolId = 'picker' | 'ladder' | 'barrow' | 'shears' | 'lantern';

export interface Settings {
  shadows: boolean;
  outlines: boolean;
  petals: boolean;
  calm: boolean;
  map: boolean;
  invertY: boolean;
}

/** an order in the post, due on the morning of `due` */
export interface Order { kind: 'machine' | 'sapling' | 'plot' | 'upgrade'; id: string; qty: number; due: number }
/** a machine loaded last thing, with the goods due in the morning */
export interface Batch { machine: MachineId; good: GoodId; due: number }
/** a whip in the ground, one stage nearer bearing every morning */
export interface Sapling { x: number; z: number; stage: number }
/** a tree grown from one of those, rebuilt on load */
export interface Planted { x: number; z: number; scale: number }

export interface State {
  basket: Record<AppleType, number>;
  stored: Record<AppleType, number>;
  discovered: Partial<Record<AppleType, boolean>>;
  picked: number;
  deposited: number;
  /** how much is left in the bear's legs, 0..1 */
  vigour: number;
  day: number;
  dayT: number;
  settings: Settings;
  /** tools carried on the bear; anything not here is on the barn rack */
  carried: ToolId[];
  equipped: ToolId | null;
  /** where the ladder is leaning, if it has been set down out in the rows */
  ladder: { x: number; z: number; ry: number } | null;
  /** where the barrow is parked, and what is in it */
  barrow: { x: number; z: number; ry: number; load: Record<AppleType, number> } | null;
  prunedTrees: number[];
  /** windfalls in the sack — bruised, unsellable, and bound for the compost */
  bruised: number;
  /** what is rotting down in the compost barrel, waiting for the morning */
  composting: number;
  /** everything the heap has taken this season, for the ledger */
  composted: number;

  /* ---- the catalogue ---- */
  /** shillings */
  purse: number;
  /** what the season has earned, all told */
  sold: number;
  goods: Record<GoodId, number>;
  machines: MachineId[];
  plots: PlotId[];
  /** what has been built onto the farm — the barn extension and what follows */
  upgrades: UpgradeId[];
  /** saplings delivered and waiting to go in the ground */
  saplings: number;
  post: Order[];
  batches: Batch[];
  growing: Sapling[];
  planted: Planted[];
}

const zero = () => ({ honeycrisp:0, grannysmith:0, golden:0, rare:0 });
export const zeroGoods = (): Record<GoodId, number> => ({ cider:0, jelly:0, rings:0 });

export const state: State = {
  basket: zero(),
  stored: zero(),
  discovered: {},
  picked: 0, deposited: 0, vigour: 1, day: 1, dayT: 0.34,
  settings: { shadows:true, outlines:true, petals:true, calm:false, map:true, invertY:false },
  carried: [],
  equipped: null,
  ladder: null,
  barrow: null,
  prunedTrees: [],
  bruised: 0, composting: 0, composted: 0,
  purse: 0, sold: 0,
  goods: zeroGoods(),
  machines: [], plots: [], upgrades: [], saplings: 0,
  post: [], batches: [], growing: [], planted: [],
};

const SAVE_KEY = 'orchardhours.save.v5';
const SAVE_KEY_V4 = 'orchardhours.save.v4';
const SAVE_KEY_V3 = 'orchardhours.save.v3';
const SAVE_KEY_V2 = 'orchardhours.save.v2';

export function save(){
  try{
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      stored: state.stored, discovered: state.discovered, picked: state.picked,
      deposited: state.deposited, vigour: state.vigour, day: state.day, settings: state.settings,
      carried: state.carried, equipped: state.equipped,
      ladder: state.ladder, barrow: state.barrow, prunedTrees: state.prunedTrees,
      bruised: state.bruised, composting: state.composting, composted: state.composted,
      purse: state.purse, sold: state.sold, goods: state.goods,
      machines: state.machines, plots: state.plots, upgrades: state.upgrades,
      saplings: state.saplings,
      post: state.post, batches: state.batches,
      growing: state.growing, planted: state.planted,
    }));
  }catch{ /* private browsing, a full disk — the orchard plays on regardless */ }
}

/* ---- the small guards the reader above leans on ---- */
const num = (v: unknown, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;

function ids<T extends string>(v: unknown, allowed: readonly T[]): T[] {
  if(!Array.isArray(v)) return [];
  return [...new Set(v.filter((x): x is T => allowed.includes(x as T)))];
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function list<T>(v: unknown, cap: number, shape: (row: any) => T): T[] {
  if(!Array.isArray(v)) return [];
  return v.filter(r => r && typeof r === 'object').slice(0, cap).map(shape);
}

export function load(){
  try{
    /* newest first; an older season is read and carried forward */
    const raw = localStorage.getItem(SAVE_KEY)
      ?? localStorage.getItem(SAVE_KEY_V4)
      ?? localStorage.getItem(SAVE_KEY_V3)
      ?? localStorage.getItem(SAVE_KEY_V2);
    if(!raw) return;
    const d = JSON.parse(raw) as Partial<State>;
    Object.assign(state.stored, d.stored ?? {});
    Object.assign(state.discovered, d.discovered ?? {});
    Object.assign(state.settings, d.settings ?? {});
    state.picked = d.picked ?? 0;
    state.deposited = d.deposited ?? 0;
    state.vigour = typeof d.vigour === 'number' ? d.vigour : 1;
    state.day = d.day ?? 1;
    /* fields a v2 save simply will not have — the defaults above stand */
    if(Array.isArray(d.carried)) state.carried = d.carried;
    if(d.equipped !== undefined) state.equipped = d.equipped;
    if(d.ladder !== undefined) state.ladder = d.ladder;
    if(d.barrow !== undefined) state.barrow = d.barrow;
    if(Array.isArray(d.prunedTrees)) state.prunedTrees = d.prunedTrees;
    state.bruised    = Math.max(0, Math.round(num(d.bruised, 0)));
    state.composting = Math.max(0, Math.round(num(d.composting, 0)));
    state.composted  = Math.max(0, Math.round(num(d.composted, 0)));

    /* ---- the catalogue, read defensively ----
       These are the only saved fields the world builds geometry from, so a
       hand-edited or half-written key must not take the orchard down with it. */
    state.purse = num(d.purse, 0);
    state.sold  = num(d.sold, 0);
    for(const k of GOOD_KEYS) state.goods[k] = Math.max(0, Math.round(num(d.goods?.[k], 0)));
    state.saplings = Math.max(0, Math.round(num(d.saplings, 0)));
    state.machines = ids(d.machines, MACHINE_KEYS);
    state.plots    = ids(d.plots, PLOT_KEYS);
    state.upgrades = ids(d.upgrades, UPGRADE_KEYS);
    state.post = list(d.post, 40, o => ({
      kind: o.kind === 'machine' || o.kind === 'sapling' || o.kind === 'plot'
            || o.kind === 'upgrade' ? o.kind : null,
      id: typeof o.id === 'string' ? o.id : null,
      qty: Math.max(1, Math.round(num(o.qty, 1))),
      due: Math.max(1, Math.round(num(o.due, 1))),
    })).filter(o => o.kind && o.id) as Order[];
    state.batches = list(d.batches, 12, b => ({
      machine: MACHINE_KEYS.includes(b.machine) ? b.machine : null,
      good: GOOD_KEYS.includes(b.good) ? b.good : null,
      due: Math.max(1, Math.round(num(b.due, 1))),
    })).filter(b => b.machine && b.good) as Batch[];
    state.growing = list(d.growing, 80, g => ({
      x: num(g.x, NaN), z: num(g.z, NaN),
      stage: Math.max(0, Math.min(SAPLING_STAGES, Math.round(num(g.stage, 0)))),
    })).filter(g => Number.isFinite(g.x) && Number.isFinite(g.z)) as Sapling[];
    state.planted = list(d.planted, 80, p => ({
      x: num(p.x, NaN), z: num(p.z, NaN),
      scale: Math.max(0.6, Math.min(1.4, num(p.scale, 1))),
    })).filter(p => Number.isFinite(p.x) && Number.isFinite(p.z)) as Planted[];
  }catch{ /* a corrupt save should not cost you the game */ }

  /* the farm may be bigger than the fence constants before anything reads them */
  applyPlots(state.plots);
}

/* the season is read back the moment this module is pulled in, so every world
   module that follows sees the saved state rather than a fresh one */
load();

export function resetSeason(){
  try{
    localStorage.removeItem(SAVE_KEY);
    localStorage.removeItem(SAVE_KEY_V4);
    localStorage.removeItem(SAVE_KEY_V3);
    localStorage.removeItem(SAVE_KEY_V2);
  }catch{ /* ignore */ }
  TYPE_KEYS.forEach(k => { state.stored[k] = 0; state.basket[k] = 0; });
  state.discovered = {};
  state.picked = 0; state.deposited = 0; state.day = 1; state.vigour = 1;
  state.carried = []; state.equipped = null;
  state.ladder = null; state.barrow = null; state.prunedTrees = [];
  state.bruised = 0; state.composting = 0; state.composted = 0;
  state.purse = 0; state.sold = 0;
  state.goods = zeroGoods();
  state.machines = []; state.plots = []; state.upgrades = []; state.saplings = 0;
  state.post = []; state.batches = []; state.growing = []; state.planted = [];
  applyPlots(state.plots);
}

/** whether a thing has been built onto the farm */
export const built = (id: UpgradeId) => state.upgrades.includes(id);

/**
 * How much of one variety the farm can put away: a barrel to start with, and
 * the four extra barrels plus the silo once the extension is up.
 */
export const storeCap = () =>
  CRATE_CAPACITY + (built('extension') ? EXTRA_BAY_CAPACITY + SILO_CAPACITY : 0);

export const basketTotal   = () => TYPE_KEYS.reduce((n,k)=> n + state.basket[k], 0);
export const storedTotal   = () => TYPE_KEYS.reduce((n,k)=> n + state.stored[k], 0);
export const varietiesFound = () => TYPE_KEYS.filter(k => state.discovered[k]).length;
