# Cosy Current

A gentle river-world simulator — a canvas-based idle game where the player's raft drifts
down procedurally generated rivers, collecting items and discovering wildlife.

**Version:** v0.2.0 Alpha  
**Author:** SitcomReality  
**Play:** Serve the directory over HTTP (no build step): `python3 -m http.server 8080`  
**Completion goal:** [docs/completion-goal.md](docs/completion-goal.md) — the v1.0 "toy
finish" scope, definition of done, and acceptance criteria.

---

## Project Overview

The player controls a raft that floats along an infinite procedural river system.
Day/night cycles, dynamic weather (rain, wind, lightning), and a living ecosystem of creatures
(fish, birds, deer, crabs, fireflies, sheep, turtles, eels) create the atmosphere.
Collectable items spawn ahead of the raft; gathering them fills an inventory and a
collection log (sticker book). Collected materials are spent in "The Dock" to
customize the raft's hull, cabin, roof, and light.

The world is generated entirely from seeded simplex + Perlin noise (FBM) with a
domain-warped river network. The world itself uses no sprite assets — everything is
drawn procedurally with the Canvas 2D API — and the only bundled binaries are fonts
plus the credit logo (`sitcomreality.png`).

### Visual Style — Straight-Line Aesthetic

A defining characteristic of the game's art style is that **almost everything is
drawn with straight, rigid lines** — no curves, no smooth arcs, no bezier paths.
Shapes are polygons built from `lineTo` calls, rectangles are `fillRect`, and
even natural forms (tree canopies, riverbanks, creatures, plants) are rendered as
hard-edged, faceted geometry. The handful of `arc()` calls in the codebase are
isolated exceptions — the headlight cone gradient mask, the collectable halo
indicator, the raft light bulb (4px dot), and crab eyes — while the other ~230
primitive draw calls across 21 renderer files are all `lineTo`/`fillRect`-based.
This gives the game a distinct, hand-hewn visual identity that sets it apart.

---

## Technology Stack

- **Language:** Vanilla JavaScript (ES modules) — no transpilers, no TypeScript.
- **Rendering:** HTML5 `<canvas>` 2D context (`alpha: false`). No WebGL.
  Nearly all drawing uses `lineTo`/`moveTo`/`fillRect` — curves are avoided by
  design (see [Visual Style](#visual-style--straight-line-aesthetic)).
- **Styling:** CSS3 with custom properties, `@font-face` for bundled fonts, flexbox layouts.
- **Fonts:** All self-hosted in `fonts/` — AldotheApache.ttf, ChineseRocksRg.otf,
  BobloxClassic.ttf, FlappyFont.ttf, plus Oswald-latin.woff2 (SIL OFL 1.1,
  formerly loaded from Google Fonts; see `fonts/OFL-Oswald.txt`).
- **Build system:** None. The project loads as static files. Serve the directory over
  HTTP (e.g. `python3 -m http.server 8080`); `file://` may fail due to ES module
  CORS restrictions in some browsers.
- **Dependencies:** None — no npm, no package.json, no lockfile, no CDN scripts.
  The game makes no network requests and runs fully offline.
- **Testing:** No unit-test framework. `webgame_check` (static) and `webgame_smoke`
  (headless Firefox) are configured via `webgame.config.json`; see
  [docs/testing.md](docs/testing.md).
- **Dev panel:** Append `?dev` to the URL to show the **DEV** button. It includes
  renderer experiments — **Terrain** (Hull / Boundary polygons / Hybrid border), the
  **Hybrid ring** depth (1–3 tiles), and **Water shading** (Baked / World-sampled +
  synced / Flat) — plus weather controls: **Auto weather**, separate **Rain**,
  **Wind strength** and **Wind direction** sliders, and a **Strike lightning** button.
  URL shortcuts: `?dev&terrain=polygon|hybrid&ring=1|2|3&shading=world|flat` and
  `?dev&rain=0..1&wind=0..1&winddir=0..359&time=0..1&lightning=1`.
  Changing a renderer option clears the chunk cache.
  See [docs/development.md](docs/development.md#dev-panel-and-renderer-experiments).
- **Package manager:** None.

---

## Project Structure

```
cosy-current/
  index.html              — Single HTML page; the entire app mounts here
  main.js                 — ES module entrypoint; imports modules/app.js
  page-init.js            — Legacy jQuery stub (unused by current code)

  styles/
    base.css              — Resets, CSS variables, font-face declarations
    layout.css            — Canvas, UI layer, start screen, HUD, modals
    effects.css           — Cloud/overlay effects, fade/pulse animations
    components.css        — Tile classes, buttons, inventory pills, collection,
                            customization dock, dev panel, notifications

  fonts/                  — Bundled .ttf / .otf / .woff2 font files (all self-hosted)

  docs/                   — Local setup, testing, known issues, provenance, and the
                            v1.0 completion goal (completion-goal.md)
  scripts/                — QA scenarios (weather-smoke.mjs, run via webgame_smoke)
  webgame.config.json     — Headless smoke-test config (webgame_check / webgame_smoke)

  modules/
    app.js                — initApp(): wire everything together, main game loop
    state.js              — createAppState(): default state factory, save merge
    game.js               — createGame(): compose game subsystems, initial spawn
    noise.js              — createNoiseEngine(): noise sampling + river system
    persistence.js        — localStorage save/load/delete (key: cosy_current_save_v1)
    ui.js                 — createUI(): DOM bindings, start screen, modals, dev panel

    noise_algorithms/     — Low-level noise function implementations
      permutations.js     — Seeded permutation table (Fisher-Yates on 256 bytes)
      perlin.js           — perlin3(x,y,z)
      simplex.js          — simplex3(x,y,z)
      fbm.js              — fbm3(x,y,z, noiseFunc, config)

    game/                 — Game logic subsystems
      constants.js        — Tile/entity type enums, DEFAULT_RAFT config
      height.js           — Terrain height quantization + tile classification
      river.js            — getSmartSteering(): raycast-based river navigation
      player.js           — Raft movement, steering, speed control
      weather.js          — Rain fronts, global wind vector, storm bearing, lightning scheduling
      collectables.js     — Spawn, animate, collect items with magnet effect
      entities.js         — City/relic entities (scenery only, no interaction)
      crafting.js         — Raft part unlock/purchase with inventory costs

    renderer/             — Canvas 2D rendering pipeline
      index.js            — Barrel export (delegates to scene.js)
      scene.js            — createRenderer(): master render loop, pass ordering
      daycycle.js         — Day/night cycle: shadow math, ambient tint, light logic
      palette.js          — Color palette definitions + runtime resolution
      vertex.js           — Deterministic vertex perturbation for terrain chunks
      hull.js             — Convex hull (monotone chain) + flood fill utilities
      chunk.js            — Barrel export (delegates to chunk/manager.js)
      chunk/
        manager.js        — createChunkManager(): chunk generation, caching, cross-fade
        boundary.js       — Tile-edge boundary tracing + closed-loop simplification
                            (experimental boundary-polygon and hybrid terrain modes)
        waterBands.js     — Quantized depth-banded water rendering with baked shading
        color.js          — hexToRgb / lerpColorHex helpers
        props.js          — Tree + aquatic flora placement per chunk
      water/
        index.js          — WaterEffects composition (wakes + waves)
        wakes.js          — V-shaped wake trail behind the raft
        waves.js          — Shoreline wave lines with gradient-driven motion
        utils.js          — getLocalFlowAngle() for wave alignment
      objects/            — Per-object drawing modules
        player.js         — Raft sprite (hull, cabin, roof, light fixture) + depth shadow
        tree.js           — Tree drawing with wind lean/sway, canopy, matching shadow
        entities.js       — City/relic drawn as jagged influence areas + structures
        aquatic.js        — Submerged aquatic plants (reeds, seagrass, kelp)
        collectables.js   — Collectable item sprites + universal halo indicator
        collectables/
          drawers.js      — Per-item sprite drawers (wood, scrap, coin, gem, etc.)
      passes/             — Ordered render passes
        terrain.js        — Chunk-based terrain rendering with cross-fade transitions
        waterShading.js   — Disabled (water shading baked into chunks)
        fauna.js          — Fauna + bird rendering passes with raft-light shadow logic
        objects.js        — Tree/aquatic/collectable rendering with per-prop lighting
        atmosphere.js     — Ambient overlay + raft headlight cone/radial gradient
        weather.js        — Ground + foreground rain: surface-aware splashes, canopy hits, parallax
        lightning.js      — Directional lightning flash wash and occasional jagged bolt
      fauna/              — Fauna rendering
        index.js          — renderFauna() + renderBirds() with night-light shadow
        shadows.js        — Creature shadow drawing
        drawers.js        — Creature dispatch wrapper (compose pattern)
        drawers/          — Individual creature drawer modules
          fish.js, eel.js, bird.js, crab.js, deer.js, critter.js,
          firefly.js, sheep.js, turtle.js, compose.js

    fauna/                — Fauna game-logic system
      index.js            — createFaunaSystem(): pool management, update loop
      constants.js        — CREATURE_DEFS definitions (type, pool, speed, behavior, colors)
      utils.js            — normalizeAngle, shortestAngleDiff, randomRange
      spawner.js          — Barrel export (delegates to spawner/index.js)
      spawner/
        index.js          — Pool-based spawn timer with water-coverage estimation
        utils.js          — Weighted random type selection, offscreen spawn positions
        attemptSpawn.js   — Per-creature valid-spawn checks, group spawning, flock setup
      behaviors.js        — Orchestrator: selects behavior driver, applies physics
      behaviors/
        flowFollow.js     — River-flow following with loiter/orbit, whisker avoidance, flocking
        flyStraight.js    — Simple straight flight for birds
        wander.js         — Random wandering with turn scheduling
        scuttle.js        — Stop-and-go scuttle for crabs
        turtle.js         — Slow turtle movement with stop-and-look
        boundaries.js     — Terrain boundary enforcement (steer away from land)
        riverUtils.js     — getRiverInfo, getFlowAngleAt, getCenterAngleAt, getRiverGradient

    ui/                   — UI module subcomponents
      inventory.js        — On-screen inventory pill display (top of HUD)
      collection.js       — Collection sticker-book modal with tabs + cards
      customization.js    — Raft customization dock with preview canvas + shop
      notifications.js    — Toast notification system (discovery, warning, info)

    data/                 — Static data registries
      items.js            — ITEM_REGISTRY: material + collectable item definitions
      raftParts.js        — RAFT_PARTS: hull/cabin/roof colors, shapes, light types
```

---

## Architecture

### App Initialization Flow

1. `index.html` loads — `<script type="module" src="main.js">` fires on DOMContentLoaded.
2. `main.js` → `import { initApp } from './modules/app.js'` — passes `canvas` and `ui-layer`.
3. `initApp()` creates the subsystems in order:
   - **State** — `createAppState()` (may merge saved data from localStorage)
   - **Noise** — `createNoiseEngine()` — seeds permutation table from state seed
   - **Game** — `createGame()` — composes height, player, entities, collectables, weather
   - **Fauna** — `createFaunaSystem()` — spawner + behavior orchestrator
   - **Renderer** — `createRenderer()` — chunk manager, water effects, render passes
   - **UI** — `createUI()` — DOM event binding, start screen, modals, dev panel
4. `renderer.start()` → sets canvas size, listens for `resize`.
5. `ui.bind()` → configures start/delete-save buttons, settings, dev panel.
6. The main loop `requestAnimationFrame(loop)` runs: game update → fauna update → collectables maintain → camera control → UI update → render → auto-save.

### Render Pipeline (ordered passes in `scene.js`)

1. `renderTerrainPass` — Draw chunk canvases (terrain hulls + water bands) with cross-fade on rebuild. Chunk destination rects are derived from shared, device-pixel-snapped world edges with a 1px overlap, so fractional zoom cannot open 1px background gaps between chunks.
2. `renderWaterShadingPass` — No-op (water shading is baked into chunk geometry).
3. `waterEffects.render` — Wakes + shoreline waves over water.
4. `renderWeatherGroundPass` — World-anchored water ripples and land ticks, drawn *before* objects so trees/fauna/raft occlude them.
5. `renderFaunaPass` — Non-bird creatures (fish, deer, crabs, etc.) with per-creature shadows.
6. `renderObjectsPass` — Trees (with wind lean/sway), aquatic plants, collectables with per-prop headlight shadow logic.
7. `drawPlayer` — Raft sprite with depth-aware shadow.
8. `renderBirdsPass` — Birds rendered on top of player.
9. `renderWeatherPass` — Foreground rain streaks + tiny canopy impact glints/drips (screen-space with camera parallax).
10. `renderAtmospherePass` — Ambient overlay (night/day tint with storm composited on top) + raft headlight cone/radial gradient.
11. `renderLightningBoltPass` / `renderLightningFlashPass` — Occasional jagged bolt, then an additive directional flash that lifts the whole frame.

### State Management

`state` is a plain mutable object created by `createAppState()`. Every subsystem receives
it and reads/writes directly — no immutability, no event bus, no observable pattern.
Persistence is manual: `persistence.js` serializes `seed`, `dayTime`, `player` position/angle,
`inventory`, `collection`, and `raft` config to `localStorage` every 30 seconds and on
`visibilitychange` (tab hidden).

### Noise & Procedural Generation

- **Terrain:** FBM (fractal Brownian motion) of 3D Perlin noise, sampled with scale,
  with time as the third dimension. Output quantized into 4 height levels (water, bank, grass, forest).
- **River Network:** A grid-aligned domain-warped system using simplex noise for warp displacement.
  River width varies per-location via low-frequency FBM (5–10 tiles half-width).
  Rays cast along the river detect land and steer the raft via winner-take-all scoring.
- **Day/Night:** `state.dayTime` (0–1) drives smoothsteps for dawn/dusk transitions,
  shadow length/alpha/direction, ambient color tint, and raft light activation.
- **Weather:** Low-frequency noise drives rain fronts, a global `wind` vector
  (`x`, `y`, `strength`, `angle`), and a slowly-drifting `stormBearing`. Rain and wind
  are coupled but not identical: storms tend to be windier, while a heavy convective
  downpour can stay relatively calm. Lightning is scheduled only above ~50% rain and
  prefers the storm bearing. Rain/wind auto-run by default; the dev panel switches to
  manual control when a slider is touched.

### Fauna System

Creatures are defined in `fauna/constants.js` with type, pool (water/land/air), size,
speed, behavior, colors. The spawner (`spawner/index.js`) runs per-pool timers and
delegates to `attemptSpawn.js` for validity checks and group spawning. Each behavior
(flow_follow, fly_straight, wander, scuttle, turtle) updates target angle and speed
each frame. Boundary enforcement steers creatures away from forbidden terrain.
Rendering dispatch is in `renderer/fauna/drawers.js` with per-creature drawer modules.

### Customization (The Dock)

`RAFT_PARTS` in `data/raftParts.js` defines unlockable parts across 7 categories
(hull/cabin/roof colours, hull/cabin shapes, light type, light colour), grouped into
three Dock tabs: Hull, Cabin, Light. Each part has a cost in inventory items. The
`crafting.js` module handles purchase + equip logic. The customization UI
(`ui/customization.js`) renders a live Canvas preview
of the raft that slowly rotates.

---

## Key Commands

Since there is no build system, the primary commands are:

| Action | Command |
|---|---|
| Run locally | `python3 -m http.server 8080` then open `http://localhost:8080/` |
| Run locally (Node) | `node "/home/reality/.dsh/skills/setup-project/scripts/serve.mjs" . --port=8080` |
| Static checks | `webgame_check` (or the WebGame harness CLI) |
| Browser smoke | `webgame_smoke` — starts its own server, no manual server needed |
| View git log | `git log --oneline` |

No install, build, lint, or format commands exist. Port 8080 may already be taken on
this machine; use any free port (the bundled Node server falls back automatically and
prints the URL it chose). Full setup notes: [docs/development.md](docs/development.md).

Run path verified **2026-11-12** (Python 3.12 static server + headless Firefox smoke:
no page/console errors, no external requests, canvas painted).

---

## Code Style Conventions

- **Language:** ES modules (`import`/`export`), no CommonJS.
- **Naming:** camelCase for variables/functions, PascalCase for constructor-like
  factory names where conventional. Module filenames are lowercase with dashes.
- **Exports:** Each subsystem exports a factory function (`createX()`) that returns
  an object with methods. Modules that are thin barrel files re-export from sub-modules.
- **State mutation:** All modules mutate `state` directly — no reducer pattern.
  New features should follow this convention.
- **No classes:** The codebase uses factory functions + closures exclusively.
  No `class`, `new`, or `this` (in the prototypical sense).
- **No external dependencies:** Do not add npm packages or CDN scripts.
  Everything should be self-contained JS + CSS.
- **Error handling:** Minimal — `console.warn` for non-fatal issues, `try/catch`
  around localStorage operations. Most rendering code assumes values are valid.
- **Comments:** Inline comments are used liberally, often explaining _why_ something
  is done rather than _what_. Tombstone comments mark removed legacy code.
- **Straight-line rendering:** All in-world drawing uses `lineTo`/`fillRect`/`strokeRect`
  — no `arc`, `bezierCurveTo`, or `quadraticCurveTo` for game objects, creatures,
  terrain, or props. Curved calls (`arc`) are reserved only for a small set of UI-level
  effects: headlight gradient mask, collectable halo indicator, and tiny detail dots
  (light bulb, crab eyes). New drawing code should follow this constraint.
- **Spacing/formatting:** Inconsistent across files — no linter or formatter is
  configured. Follow the surrounding file's style when editing.

---

## Testing

There is **no unit-test framework or test runner**. Two automated checks are configured
in `webgame.config.json`:

- `webgame_check` — static syntax/import/asset/external-URL check. Must report
  **0 external** references and 0 errors.
- `webgame_smoke` — headless Firefox run: waits for `window.__APP_READY__`, asserts the
  title, screenshots the start screen, clicks **New/Continue Journey**, waits 2 s, and
  asserts the canvas is painted. It also fails on any external network request.
- `scripts/weather-smoke.mjs` — deterministic weather QA scenario: forces clear night
  vs. stormy night (asserts the storm is darker), triggers lightning, frames a windy
  rain shot, and checks the debug weather API. Run with
  `webgame_smoke --scenario scripts/weather-smoke.mjs`.

Manual verification is still loading the game in a browser and playing it. For bugs:
- Check the browser's developer console for errors.
- For rendering issues, inspect the canvas drawing calls.
- For game logic issues, add temporary `console.log` statements.

Details and a manual checklist: [docs/testing.md](docs/testing.md).

---

## Security Considerations

- **localStorage** is used for save data (key `cosy_current_save_v1`). No sensitive
  credentials are stored.
- **No network requests are made.** All fonts and images are bundled locally; no CDN
  scripts, analytics, or external links load at runtime. The game works offline.
- No user input is rendered as HTML (all DOM creation uses `textContent` or
  `innerHTML` with trusted strings).
- The project runs entirely client-side with no backend.

---

## Common Development Patterns

**Adding a new creature type:**
1. Add a definition to `fauna/constants.js` `CREATURE_DEFS` (pool, behavior, colors).
2. If new behavior, add a driver in `fauna/behaviors/` and wire it in `fauna/behaviors.js`.
3. Add spawn validation in `fauna/spawner/attemptSpawn.js`.
4. Add a drawer module in `renderer/fauna/drawers/`.
5. Wire the drawer in `renderer/fauna/drawers.js` `drawCreature()`.

**Adding a new collectable item:**
1. Add entry to `data/items.js` `ITEM_REGISTRY` with id, name, type, rarity, spawnRules.
2. Add a drawer in `modules/renderer/objects/collectables/drawers.js`.

**Changing the render pipeline:**
Edit `modules/renderer/scene.js` `renderFrame()` — passes run in sequence, compositing
on the main canvas. New passes should follow the same pattern: receive `(ctx, state, ...)`.

**Adding a new raft customization part:**
Add an entry to the relevant category in `data/raftParts.js`. The UI reads this
dynamically — no other wiring needed.

---

## Git History Conventions

Commits follow the format: `v<number>: <short description>` (e.g., `v323: In the raft customization dock...`).
The number appears to increment sequentially with each change request. The `main` branch
is the only branch.
