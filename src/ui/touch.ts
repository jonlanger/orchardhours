/* ============================================================
   Touch controls — a stick for the legs and two buttons, shown
   only where there is no mouse.
   ============================================================ */
import { isTouch, stick } from '../core/input';
import { useNearest } from '../player/interact';
import { $ } from './hud';

let jumpHeld = false;
export const touchJump = { pressed: false };

export function initTouch(){
  if(!isTouch) return;
  document.body.classList.add('touch');

  const pad = document.createElement('div');
  pad.className = 'stick';
  pad.innerHTML = '<i></i>';
  $('ui').appendChild(pad);
  const knob = pad.querySelector<HTMLElement>('i')!;

  const buttons = document.createElement('div');
  buttons.className = 'touch-btns';
  buttons.innerHTML = `
    <button class="tbtn" id="tAct" aria-label="Use">E</button>
    <button class="tbtn big" id="tJump" aria-label="Jump">▲</button>`;
  $('ui').appendChild(buttons);

  /* ---- the stick ---- */
  let id: number | null = null;
  const R = 46;
  const centre = { x:0, y:0 };

  pad.addEventListener('pointerdown', e => {
    id = e.pointerId;
    const r = pad.getBoundingClientRect();
    centre.x = r.left + r.width/2;
    centre.y = r.top + r.height/2;
    pad.setPointerCapture(e.pointerId);
    move(e);
  });
  pad.addEventListener('pointermove', e => { if(e.pointerId === id) move(e); });
  const release = (e: PointerEvent) => {
    if(e.pointerId !== id) return;
    id = null;
    stick.set(0,0);
    knob.style.transform = '';
  };
  pad.addEventListener('pointerup', release);
  pad.addEventListener('pointercancel', release);

  function move(e: PointerEvent){
    let dx = e.clientX - centre.x, dy = e.clientY - centre.y;
    const d = Math.hypot(dx, dy);
    if(d > R){ dx *= R/d; dy *= R/d; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    stick.set(dx/R, -dy/R);            // screen down is backwards
  }

  /* ---- the buttons ---- */
  const jump = $('tJump');
  jump.addEventListener('pointerdown', e => { e.preventDefault(); jumpHeld = true; touchJump.pressed = true; });
  const letGo = () => { jumpHeld = false; };
  jump.addEventListener('pointerup', letGo);
  jump.addEventListener('pointercancel', letGo);

  $('tAct').addEventListener('pointerdown', e => { e.preventDefault(); useNearest(); });

  /* the prompt is a button too, on any device */
  $('prompt').addEventListener('click', () => useNearest());
}

/** drained once per frame by the controller */
export function takeTouchJump(){
  const j = touchJump.pressed;
  touchJump.pressed = false;
  return j || jumpHeld;
}
