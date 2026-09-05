/* ============================================================
   The boot curtain — a line-art apple tree that draws itself
   while the world is built. The drawn length is the progress bar:
   soil, trunk, branches, then the crown closing and the fruit.
   Markup and styles live inline in index.html so the curtain is
   on screen before this bundle has finished downloading.
   ============================================================ */

const el = document.getElementById('boot');
const labelEl = document.getElementById('bootLabel');
const paths = el ? [...el.querySelectorAll<SVGPathElement>('.draw')] : [];

/* every stroke measured once, so the tree draws at an even pace
   whatever its shape — no hand-tuned per-path fractions */
const lengths = paths.map(p => { try { return p.getTotalLength(); } catch { return 0; } });
const totalLength = lengths.reduce((a, b) => a + b, 0) || 1;

paths.forEach((p, i) => {
  p.style.strokeDasharray = `${lengths[i]}`;
  p.style.strokeDashoffset = `${lengths[i]}`;
});

function paint(p: number){
  let left = p * totalLength;
  for(let i = 0; i < paths.length; i++){
    const drawn = Math.max(0, Math.min(lengths[i], left));
    paths[i].style.strokeDashoffset = `${lengths[i] - drawn}`;
    left -= lengths[i];
  }
}

/* ---- progress, eased ---- */
let target = 0, shown = 0, last = 0, raf = 0, running = false;

/* where each stage begins along the line, so the words follow the drawing
   rather than running ahead of it when the building turns out to be quick */
const marks: { at: number; label: string }[] = [];
let labelAt = 0;
const DWELL = 400;   // ms a stage name keeps the floor before the next one

function tick(now: number){
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if(shown < target){
    /* a steady floor plus an ease-out, so a fast machine still gets
       to watch the tree finish rather than see a single flash */
    shown = Math.min(target, shown + (0.6 + 3.0 * (target - shown)) * dt);
    paint(shown);
  }
  let due = '';
  for(const m of marks) if(m.at <= shown) due = m.label;
  if(due && labelEl && labelEl.textContent !== due && now - labelAt >= DWELL){
    labelAt = now;
    setLabel(due);
  }
  if(running) raf = requestAnimationFrame(tick);
}

export function begin(){
  if(!el || running) return;
  running = true; last = performance.now();
  raf = requestAnimationFrame(tick);
}

function stop(){ running = false; cancelAnimationFrame(raf); }

const nextPaint = () => new Promise<void>(r =>
  requestAnimationFrame(() => setTimeout(r, 0)));

export function setLabel(text: string){
  if(!labelEl || labelEl.textContent === text) return;
  labelEl.textContent = text;
  labelEl.classList.remove('in');
  void labelEl.offsetWidth;          /* restart the fade */
  labelEl.classList.add('in');
}

/* ---- stages ----
   Each stage names itself, hands the browser a frame to draw with,
   then does its (synchronous, blocking) share of the building. The
   line catches up once the work is done. Weights are rough costs. */
let planned = 1, spent = 0;

/** The sum of every stage weight, so each one knows its share of the line. */
export function plan(totalWeight: number){ planned = totalWeight || 1; }

export async function stage<T>(label: string, weight: number, work: () => T | Promise<T>): Promise<T>{
  marks.push({ at: spent / planned, label });
  await nextPaint();
  const out = await work();
  spent += weight;
  target = Math.min(1, spent / planned);
  return out;
}

/** Fill the last of the line, set the fruit, then lift the curtain. */
export async function finish(){
  if(!el) return;
  target = 1;
  while(running && shown < 0.999){ await nextPaint(); }
  paint(1);
  marks.length = 0;
  setLabel('');
  el.classList.add('fruiting');
  await new Promise(r => setTimeout(r, 520));
  el.classList.add('gone');
  await new Promise(r => setTimeout(r, 700));
  stop();
  el.remove();
}

/** Something went wrong; keep the curtain up and say so plainly. */
export function fail(message: string){
  stop();
  el?.classList.add('failed');
  if(labelEl){ labelEl.classList.remove('in'); labelEl.textContent = message; }
}
