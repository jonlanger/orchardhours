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
| **F** | eat an apple out of the basket · **C** sit down · **R** throw one |
| **M** | the orchard plan · **B** the almanac · **Esc** the menu |

Tapping an apple still sends Pom over to pick it, and tapping the ground still
walks them there. On a phone there is a stick, a jump button, an action button,
and three small ones for eating, sitting and throwing.

Picking is done the way it is done in a real orchard: the apple is cupped,
rolled upwards until the calyx points at the top of the tree, and twisted off
stem and all — never pulled down, which takes the fruiting spur with it. The
pole does the same thing from underneath and catches the fruit in its bag.

Reaching all day costs Pom something. The meter under the buttons is what is
left in its legs: it slows down as that runs out, and an apple, a sit in the
grass, or a night's sleep puts it back.

Anything above head height needs the picking pole; the ladder opens up the
middle of a tree; the barrow takes the overflow once the basket is full; the
shears make a tree set a heavier crop by morning; the lantern earns its keep
after dusk. All five live on the rack inside the barn.

## The catalogue

A writing desk in the barn keeps a merchant's catalogue. Fruit is sold out of
the barrels — never the basket — and so are the goods the barn makes from it.

Ordering is the other half of the page. A **cider press**, a **preserving
kettle** and a **drying rack** each turn barrelled apples into something worth
more, overnight; load one last thing and the cider, jelly or dried rings are
waiting in the morning. None of them will touch an Amber Russet, which is worth
more in the barrel than in a jar.

The same page sells **bare-rooted saplings** — plant one anywhere there is room
and it bears within the week — and the **deeds to the neighbouring fields**,
which move the fence out and give you somewhere to plant them.

Everything ordered arrives with the next morning's post, so the day you spend
picking is the day your order is on the road.

## Layout

```
src/
  core/     renderer, loop, input, camera rig, materials, save, settings,
            the catalogue's arithmetic
  world/    ground, trees, sky and the hour, props, the barn and its interior,
            the desk, the machines, saplings, land, collision
  player/   the rig, the character controller, picking, tools, interaction,
            vigour, and the eating/sitting/throwing antics
  ui/       HUD, overlays, the catalogue, the tool belt, the map, touch
            controls, boot curtain
```

`core/loop.ts` runs gameplay on a fixed 1/60 step and everything else once per
frame; systems register themselves rather than being called from one place.
`core/input.ts` owns the keyboard and decides whether a gesture was a tap aimed
at the world or a drag aimed at the camera.
