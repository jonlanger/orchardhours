/* ============================================================
   Vigour — what the day takes out of a bear.
   Picking overhead is the expensive part; walking costs a little,
   running costs more. Sitting down and eating an apple put it back.
   ============================================================ */
import { TIRED, SPENT, VIG_WALK, VIG_RUN, VIG_CLIMB, VIG_STAND } from '../core/config';
import { state } from '../core/save';

export const vigour = () => state.vigour;
export const tired  = () => state.vigour < TIRED;
export const spent  = () => state.vigour < SPENT;

/** 1 at full strength, down to about two thirds when the legs have gone */
export const pace = () => 0.66 + 0.34 * Math.min(1, state.vigour / TIRED);

let lastNote = 1;

export function drain(n: number){
  state.vigour = Math.max(0, state.vigour - n);
}
export function refill(n: number){
  state.vigour = Math.min(1, state.vigour + n);
  if(state.vigour > TIRED + 0.06) lastNote = 1;
}
/** a night's sleep, or the start of a fresh season */
export function rested(){ state.vigour = 1; lastNote = 1; }

/** what the bear would say about it, once per crossing */
export function tirednessNote(): string | null {
  const v = state.vigour;
  if(v < SPENT && lastNote > SPENT){
    lastNote = v;
    return 'Pom is worn out. Sit down (C) and eat an apple (F), or turn in for the night.';
  }
  if(v < TIRED && lastNote > TIRED){
    lastNote = v;
    return 'That is a lot of reaching. An apple would help — press F to eat one.';
  }
  lastNote = Math.min(lastNote, v);
  return null;
}

/** the walking, running and standing part of the drain */
export function updateVigour(dt: number, speed: number, mode: 'ground'|'air'|'ladder', running: boolean){
  if(mode === 'ladder'){ drain(VIG_CLIMB*dt*(0.3 + speed)); return; }
  if(speed > 0.25) drain((running ? VIG_RUN : VIG_WALK) * dt * Math.min(1.4, speed/3.1 + 0.35));
  else drain(VIG_STAND*dt);
}

/* ---- the little meter under the basket ---- */
let bar: HTMLElement | null = null, panel: HTMLElement | null = null, shown = -1;

export function updateVigourMeter(){
  bar ??= document.getElementById('vigourBar');
  panel ??= document.getElementById('vigourPanel');
  if(!bar || !panel) return;
  const v = state.vigour;
  if(Math.abs(v - shown) < 0.004) return;
  shown = v;
  bar.style.width = `${Math.round(v*100)}%`;
  panel.classList.toggle('low', v < TIRED);
  panel.classList.toggle('out', v < SPENT);
}
