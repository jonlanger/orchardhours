/* ============================================================
   ORCHARD HOURS
   A quiet season in the apple rows.
   ============================================================ */
import './style.css';
import * as boot from './ui/boot';

/* The world is built at import time, module by module, so the modules
   are pulled in one stage at a time: each stage gets its own stretch of
   the tree on the boot curtain before it blocks the thread. The weights
   are rough shares of the work — the rows cost the most by far. */
const W = { ground:1.0, sky:0.6, rows:2.2, barn:1.8, grass:1.2, saplings:0.4, bear:0.9, gate:0.7 };
boot.plan(Object.values(W).reduce((a, b) => a + b, 0));

async function main(){
  boot.begin();

  const [renderer, save, loop, input, settings] = await boot.stage('Clearing the ground', W.ground, () =>
    Promise.all([
      import('./core/renderer'), import('./core/save'), import('./core/loop'),
      import('./core/input'), import('./core/settings'),
    ]));

  const sky = await boot.stage('Raising the sky', W.sky, () => import('./world/sky'));
  const trees = await boot.stage('Planting the rows', W.rows, () => import('./world/trees'));

  const [barn, barnInterior, silo, desk, machines, economy] = await boot.stage('Building the barn', W.barn, () =>
    Promise.all([import('./world/barn'), import('./world/barnInterior'),
                 import('./world/silo'), import('./world/desk'),
                 import('./world/machines'), import('./core/economy')]));

  const props = await boot.stage('Letting the grass in', W.grass, () => import('./world/props'));
  const saplings = await boot.stage('Setting the young trees', W.saplings, () => import('./world/saplings'));

  const [rig, controller, picking, interaction, interact, tools, antics, vigour, cameraRig] =
    await boot.stage('Waking the bear', W.bear, () => Promise.all([
      import('./player/rig'), import('./player/controller'), import('./player/picking'),
      import('./player/interaction'), import('./player/interact'), import('./player/tools'),
      import('./player/antics'), import('./player/vigour'),
      import('./core/cameraRig'),
    ]));

  const [THREE, hud, overlays, minimap, touch, land] = await boot.stage('Opening the gate', W.gate, () =>
    Promise.all([
      import('three'), import('./ui/hud'), import('./ui/overlays'),
      import('./ui/minimap'), import('./ui/touch'), import('./world/land'),
    ]));

  const { scene, camera } = renderer;

  /* ---- boot ---- */
  settings.applySettings();
  hud.renderBasket();
  hud.renderPurse();
  picking.updateBasketFruit();
  overlays.initOverlays();
  interaction.initInteraction();
  touch.initTouch();

  input.setBlocker(overlays.overlayOpen);

  /* keys that belong to the shell rather than to the bear */
  addEventListener('keydown', e => {
    if(e.key === 'Escape'){ overlays.overlayOpen() ? overlays.closeOverlays() : overlays.openMenu(); }
    if(e.key.toLowerCase() === 'b' && !overlays.overlayOpen()) overlays.openBarn('almanac');
  });

  /* ---- systems ---- */
  loop.addFixed((dt) => {
    controller.updateController(dt, performance.now()/1000);
    picking.updatePicking(dt);
  });

  loop.addFrame((dt, time) => {
    tools.updateTools(dt);
    antics.updateAntics(dt);
    machines.updateMachines(dt, time);
    interact.updateInteract();
    minimap.updateMinimap(dt);
    vigour.updateVigourMeter();
  });

  sky.onNewDay(day => {
    vigour.rested();
    economy.overnight(day);
    machines.refreshMachines();
    saplings.overnight();
    /* the heap goes out on the rows first, and the trees set the better for it */
    const fed = economy.spreadCompost();
    const back = trees.regrowOvernight(fed);
    hud.toast(back
      ? `Day ${day}. The trees have set ${back} more apples overnight${fed ? ', the composted rows best of all' : ''}.`
      : `Day ${day} in the orchard.`);
  });

  loop.addFrame((dt, time) => {
    sky.updateDay(dt, rig.character.position);
    cameraRig.updateCamera(dt);
    trees.updateTrees(dt, time, camera.position, cameraRig.focus);
    props.updateProps(dt, time);
    barnInterior.updateBarnInterior(dt, camera.position);
    sky.followCamera();
  });

  loop.addPre(() => input.beginFrame());
  loop.addPost(() => input.endFrame());

  const render = () => renderer.renderer.render(scene, camera);
  render();                       /* one frame behind the curtain, so the
                                     shaders are compiled before it lifts */
  loop.start(render);

  boot.finish();                  /* the orchard runs while the curtain fades */

  /* ---- the opening line, then quiet ---- */
  setTimeout(()=>{
    if(hud.hintIsShown()) hud.setHint(input.isTouch
      ? 'Stick to walk · drag to look · tap an apple to pick it'
      : 'WASD to walk · drag to look · tap an apple to pick it · F to eat, C to sit, R to throw');
  }, 100);
  setTimeout(hud.hideHint, 9000);
  /* a nudge toward the barn, for anyone who has not found the rack yet */
  setTimeout(()=>{
    if(save.state.carried.length || overlays.overlayOpen()) return;
    hud.setHint('The pole, the ladder and the barrow are on the rack inside the barn');
    setTimeout(hud.hideHint, 8000);
  }, 26000);

  addEventListener('beforeunload', save.save);

  window.OH = {
    THREE, scene, camera, renderer: renderer.renderer, state: save.state,
    character: rig.character, rig: rig.rig, $: hud.$,
    cam: cameraRig.cam, player: controller.player, walkTo: controller.walkTo,
    walkToApple: controller.walkToApple, startClimb: controller.startClimb,
    recenterBehind: cameraRig.recenterBehind,
    openMap: minimap.openMap, closeMap: minimap.closeMap, mapOpen: minimap.mapOpen,
    apples: trees.apples, trees: trees.trees, barn, tools, interact, antics, vigour,
    economy, desk, machines, saplings, land, silo,
    canReach: picking.canReach, refreshBarrels: barnInterior.refreshBarrels,
    deposit: overlays.deposit,
    /** advance the world by hand — used by automated checks */
    step: (s = 1) => loop.step(s, render),
  };
}

declare global {
  interface Window { OH: Record<string, unknown> }
}

main().catch(err => {
  console.error(err);
  boot.fail('The orchard would not open. Reload to try again.');
});
