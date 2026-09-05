/* ============================================================
   Touch controls — a stick for the legs and two buttons, shown
   only where there is no mouse.
   ============================================================ */
import { isTouch, stick } from '../core/input';
import { useNearest } from '../player/interact';
import { eat, hurl, toggleSit } from '../player/antics';
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
    <div class="tsmall">
      <button class="tbtn sm" id="tEat" aria-label="Eat an apple"><svg viewBox="0 0 24 24" fill="none">
        <path d="M12 6.6c-3.3 0-5.2 2.2-5.2 5.5 0 3.7 2.6 8.2 5.2 8.2s5.2-4.5 5.2-8.2c0-3.3-1.9-5.5-5.2-5.5z"
          fill="#C4553C"/><path d="M12 6.6c0-1.9 1.1-3.3 2.9-3.7.1 1.7-1 3.3-2.9 3.7z" fill="#6FA24A"/>
        <path d="M17.6 9.2a3.4 3.4 0 0 1-3.2 3.6 3.4 3.4 0 0 0 3 3.4" stroke="#FBF3E2" stroke-width="1.5"/></svg></button>
      <button class="tbtn sm" id="tSit" aria-label="Sit down"><svg viewBox="0 0 24 24" fill="none"
        stroke="#6B4A33" stroke-width="1.8" stroke-linecap="round"><circle cx="9" cy="5.6" r="2.2"/>
        <path d="M7.4 9.4v5.2h6.4M13.8 14.6l3.4 4.4M7.4 14.6v4.4"/></svg></button>
      <button class="tbtn sm" id="tThrow" aria-label="Throw an apple"><svg viewBox="0 0 24 24" fill="none">
        <path d="M3.5 18.5C6 10.5 12 6 20 5" stroke="#6B4A33" stroke-width="1.7"
          stroke-linecap="round" stroke-dasharray="3 3"/><circle cx="19.4" cy="5.4" r="2.9" fill="#C4553C"/></svg></button>
    </div>
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
  $('tEat').addEventListener('pointerdown', e => { e.preventDefault(); eat(); });
  $('tSit').addEventListener('pointerdown', e => { e.preventDefault(); toggleSit(); });
  $('tThrow').addEventListener('pointerdown', e => { e.preventDefault(); hurl(); });

  /* the prompt is a button too, on any device */
  $('prompt').addEventListener('click', () => useNearest());
}

/** drained once per frame by the controller */
export function takeTouchJump(){
  const j = touchJump.pressed;
  touchJump.pressed = false;
  return j || jumpHeld;
}
