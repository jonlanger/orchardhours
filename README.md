# Orchard Hours

A quiet season in the apple rows. Walk a bear called Pom around a planted
orchard, pick what is ripe, and put it away properly.

Built with [three.js](https://threejs.org/) and TypeScript, bundled by Vite.
No framework, no assets to load — every tree, apple and barrel is generated in
code at start-up.

## Running it

```bash
npm install
npm run dev
```

Then open the address Vite prints (http://127.0.0.1:5321 by default).

```bash
npm run build     # type-check, then bundle into dist/
npm run preview   # serve that bundle
npm run check     # type-check only
```

`dist/` is a plain static site: drop it on Netlify, Vercel, Cloudflare Pages,
GitHub Pages or any web server. There is no backend; the season is kept in the
browser's local storage.

## Playing

| | |
|---|---|
| **W A S D** | walk, relative to the camera |
| **Shift** | hurry |
| **Space** | hop |
| **drag** / **arrow keys** | swing the camera around Pom |
| **scroll** / **pinch** | pull back |
| **shift-drag** | shift the frame sideways |
| **1**–**5** | reach for a tool · **X** puts it away |
| **E** | use whatever is in front of you |
| **M** | the orchard plan · **B** the almanac · **Esc** the menu |

Tapping an apple still sends Pom over to pick it, and tapping the ground still
walks him there. On a phone there is a stick, a jump button and an action
button instead.

Anything above head height needs the picking pole; the ladder opens up the
middle of a tree; the barrow takes the overflow once the basket is full; the
shears make a tree set a heavier crop by morning; the lantern earns its keep
after dusk. All five live on the rack inside the barn.

## Layout

```
src/
  core/     renderer, loop, input, camera rig, materials, save, settings
  world/    ground, trees, sky and the hour, props, the barn and its interior,
            collision
  player/   the rig, the character controller, picking, tools, interaction
  ui/       HUD, overlays, the tool belt, the map, touch controls
```

`core/loop.ts` runs gameplay on a fixed 1/60 step and everything else once per
frame; systems register themselves rather than being called from one place.
`core/input.ts` owns the keyboard and decides whether a gesture was a tap aimed
at the world or a drag aimed at the camera.
