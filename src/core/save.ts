/* ============================================================
   Game state, and the versioned save behind it
   ============================================================ */
import type { AppleType } from './config';
import { TYPE_KEYS } from './config';

export type ToolId = 'picker' | 'ladder' | 'barrow' | 'shears' | 'lantern';

export interface Settings {
  shadows: boolean;
  outlines: boolean;
  petals: boolean;
  calm: boolean;
  map: boolean;
  invertY: boolean;
}

export interface State {
  basket: Record<AppleType, number>;
  stored: Record<AppleType, number>;
  discovered: Partial<Record<AppleType, boolean>>;
  picked: number;
  deposited: number;
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
}

const zero = () => ({ honeycrisp:0, grannysmith:0, golden:0, rare:0 });

export const state: State = {
  basket: zero(),
  stored: zero(),
  discovered: {},
  picked: 0, deposited: 0, day: 1, dayT: 0.34,
  settings: { shadows:true, outlines:true, petals:true, calm:false, map:true, invertY:false },
  carried: [],
  equipped: null,
  ladder: null,
  barrow: null,
  prunedTrees: [],
};

const SAVE_KEY = 'orchardhours.save.v3';
const SAVE_KEY_V2 = 'orchardhours.save.v2';

export function save(){
  try{
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      stored: state.stored, discovered: state.discovered, picked: state.picked,
      deposited: state.deposited, day: state.day, settings: state.settings,
      carried: state.carried, equipped: state.equipped,
      ladder: state.ladder, barrow: state.barrow, prunedTrees: state.prunedTrees,
    }));
  }catch{ /* private browsing, a full disk — the orchard plays on regardless */ }
}

export function load(){
  try{
    /* v3 first; fall back to a v2 season and carry it forward */
    const raw = localStorage.getItem(SAVE_KEY) ?? localStorage.getItem(SAVE_KEY_V2);
    if(!raw) return;
    const d = JSON.parse(raw) as Partial<State>;
    Object.assign(state.stored, d.stored ?? {});
    Object.assign(state.discovered, d.discovered ?? {});
    Object.assign(state.settings, d.settings ?? {});
    state.picked = d.picked ?? 0;
    state.deposited = d.deposited ?? 0;
    state.day = d.day ?? 1;
    /* fields a v2 save simply will not have — the defaults above stand */
    if(Array.isArray(d.carried)) state.carried = d.carried;
    if(d.equipped !== undefined) state.equipped = d.equipped;
    if(d.ladder !== undefined) state.ladder = d.ladder;
    if(d.barrow !== undefined) state.barrow = d.barrow;
    if(Array.isArray(d.prunedTrees)) state.prunedTrees = d.prunedTrees;
  }catch{ /* a corrupt save should not cost you the game */ }
}

/* the season is read back the moment this module is pulled in, so every world
   module that follows sees the saved state rather than a fresh one */
load();

export function resetSeason(){
  try{ localStorage.removeItem(SAVE_KEY); localStorage.removeItem(SAVE_KEY_V2); }catch{ /* ignore */ }
  TYPE_KEYS.forEach(k => { state.stored[k] = 0; state.basket[k] = 0; });
  state.discovered = {};
  state.picked = 0; state.deposited = 0; state.day = 1;
  state.carried = []; state.equipped = null;
  state.ladder = null; state.barrow = null; state.prunedTrees = [];
}

export const basketTotal   = () => TYPE_KEYS.reduce((n,k)=> n + state.basket[k], 0);
export const storedTotal   = () => TYPE_KEYS.reduce((n,k)=> n + state.stored[k], 0);
export const varietiesFound = () => TYPE_KEYS.filter(k => state.discovered[k]).length;
