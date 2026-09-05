/* ============================================================
   A very small event bus — lets systems talk without importing
   each other, which is what keeps the module graph acyclic.
   ============================================================ */
import type * as THREE from 'three';

export interface Events {
  /* walk the bear somewhere; the controller listens */
  'walk:to': { point: THREE.Vector3 };
  /* send the bear to the barn doors */
  'walk:barn': void;
  /* the controller reached a queued destination */
  'arrive:barn': void;
  /* something wants the pause menu back on screen */
  'menu:open': void;
  /* a machine was delivered and should appear in the barn */
  'machine:installed': { id: string };
  /* a plot was bought; the fence and the plan follow the new bounds */
  'land:bought': { id: string };
  /* the barn sheet should redraw itself where it stands */
  'barn:render': void;
  /* the desk was used; open the catalogue */
  'catalogue:open': void;
  /* the basket contents changed */
  'basket:changed': { bump?: string };
  /* a save-worthy change happened */
  'state:save': void;
}

type Handler<K extends keyof Events> = (payload: Events[K]) => void;

const handlers = new Map<string, Set<Handler<never>>>();

export function on<K extends keyof Events>(event: K, fn: Handler<K>): () => void {
  let set = handlers.get(event);
  if (!set) handlers.set(event, (set = new Set()));
  set.add(fn as Handler<never>);
  return () => { set!.delete(fn as Handler<never>); };
}

export function emit<K extends keyof Events>(
  event: K, ...args: Events[K] extends void ? [] : [Events[K]]
): void {
  const set = handlers.get(event);
  if (!set) return;
  for (const fn of set) (fn as Handler<K>)(args[0] as Events[K]);
}
