# Local development

Cosy Current is a zero-build static web game: HTML, CSS, ES modules, and Canvas 2D.
There is nothing to install and no compile step.

## Prerequisites

- **Python 3** (tested with 3.12.3) — the simplest static file server.
- **A browser** — Firefox or a Chromium-based browser. Tested with headless Firefox 159.
- Node.js is only needed for the optional WebGame test harness; it is not needed to play.

## Run it

From the project root:

```bash
python3 -m http.server 8080
```

Then open <http://localhost:8080/>.

- Do **not** open `index.html` with `file://`; ES modules and `@font-face` may be blocked
  by browser CORS rules.
- If port 8080 is already in use, pick another, e.g.
  `python3 -m http.server 8090` → <http://localhost:8090/>.
- Any static server that returns correct MIME types works. The setup-time verification
  also used the zero-dependency harness server:

  ```bash
  node "/home/reality/.dsh/skills/setup-project/scripts/serve.mjs" . --port=8080
  ```

  That path is specific to this machine. The server prints the URL it actually bound
  (it falls back to the next free port if 8080 is taken).

## Fully offline / no external connections

As of the setup pass (2026-11-12) the game loads **nothing** from the network beyond the
files served from the project directory:

- All CSS and JS are local; there are no `<script src="https://...">` tags and no CDN
  imports.
- All fonts are self-hosted in `fonts/`. The formerly external **Oswald** Google Font is
  vendored as `fonts/Oswald-latin.woff2` (SIL Open Font License 1.1, license text in
  `fonts/OFL-Oswald.txt`) and declared in `styles/base.css`.
- The WebSim credit logo is local (`sitcomreality.png`). Its outbound
  `https://websim.com/...` anchor was removed, so the credit is no longer a link.
- No analytics, trackers, fetch/XHR/WebSocket calls, or external images remain.

Audit for regressions from the project root:

```bash
grep -RInE 'https?://|//cdn|@import' --include='*.html' --include='*.css' --include='*.js' .
```

Expected result: no matches. (Among served app files, the only URL-containing file left
is the OFL license text, which the browser never requests. Markdown docs may of course
contain links.)

You can also load the page with the network disabled; it should boot and play normally.
The browser smoke test fails on any external request, so it guards this automatically.

## Dev panel, weather controls, and renderer experiments

Append `?dev` to the game URL to reveal the **DEV** button in the bottom bar. The panel
contains live weather controls plus the experimental renderer switches.

### Weather controls

| Control | Values | What it does |
|---|---|---|
| **Auto weather** | on / off | On by default. Rain fronts and wind evolve on their own, and the sliders follow the live values as read-only feedback. The readout names the current rain phase (`clear`, `build`, `rain`, `clearing`). Touching any weather slider switches to manual; tick Auto to hand control back. |
| **Rain** | 0–100% | Rain intensity. Also controls splash density and lightning frequency. Automatic fronts build, hold for at least a minute, and clear rather than flickering on and off. |
| **Wind strength** | 0–100% | Global wind vector magnitude. Trees lean/sway, shadows follow, and rain slants. Rain streak angle and drop motion share one vector, so at full wind the rain visibly travels along its ~45° lean. |
| **Wind direction** | 0–359° | 0° = east, 90° = south, 180° = west, 270° = north (screen/world axes). |
| **Strike lightning** | button | Fires a manual strike immediately, even when it is not raining, for visual testing. |

Rain and wind are coupled in automatic mode (storms tend to be windier, but a heavy
downpour can stay relatively calm). Automatic rain runs as a four-phase cell —
`clear` → `build` → `rain` → `clearing` — with long dry spells, a smooth arrival,
at least 70 seconds of sustained rain, and a smooth departure. The rain intensity is
smoothed toward the phase target, but the phase durations (not noise thresholds) own the
timing, so a front cannot flicker on and off in a couple of seconds. Lightning is only
scheduled automatically when rain is above ~50%, and strikes prefer the
slowly-drifting storm bearing rather than a random screen direction.

A strike briefly acts as a second sun. While the flash is active it overrides the
time-of-day shadow direction and tree-face lighting, lights the whole scene from the
storm-bearing side, and overwhelms the raft headlamp (its cone disappears until the
flash decays). Cast shadows therefore point away from the strike; this applies to
trees, aquatic plants, fauna, birds and the raft.

The lightning light source is a hard, latched state rather than a blend. Shadow
direction/side lighting and the headlamp switch once when the strike begins and once
when its last after-pulse has faded; only the flash brightness fades continuously. This
prevents shadows from sliding between the lightning and sun directions and prevents the
headlamp cone from expanding/contracting on every strike.

The same state can be forced from the URL:

```text
/?dev&rain=1&wind=0.8&winddir=90&time=0.95   # night storm, 80% wind from the south
/?dev&rain=1&wind=1&winddir=0&time=0.35      # daytime storm, full east wind
/?dev&time=0.95&lightning=1                  # night + an immediate strike
```

The page also exposes a small debug surface used by the weather smoke scenario:

```js
window.__webgame.snapshot()                  // dayTime, weather, player, camera
window.__webgame.setWeather({ rain: 1, windStrength: 1, windAngle: 0, auto: false })
window.__webgame.setDayTime(0.95)
window.__webgame.setCamera(x, y)             // unlocks the camera for framing
window.__webgame.strikeLightning()
window.__webgame.setLightning({ flash: 1, dirX: -0.7, dirY: -0.7, boltSeed: 0.9 })
```

`setLightning()` is for deterministic QA only; the game loop resumes decaying the flash
on the next frame.

### Renderer experiments

| Control | Values | What it does |
|---|---|---|
| **Terrain** | Hull (current) / Boundary polygons / Hybrid border | **Hull** is the original convex-hull renderer. **Boundary polygons** traces the real tile edges for the whole chunk (more stair-stepped, but no chunk-edge cuts). **Hybrid border** keeps the hulls in the interior but redraws a thin ring of exact tile cells over them at each chunk border. |
| **Hybrid ring** | 1 / 2 / 3 tiles | How deep the exact-tile hybrid patch extends from each chunk border. Only affects **Hybrid border**. 1 tile is the least intrusive; 2–3 tiles correct more of the hull but become visibly tile-based. |
| **Water shading** | Baked (current) / World-sampled + synced / Flat | **Baked** is the original per-chunk gradient shading. **World-sampled** samples the gradient from the band's world-space centroid and rebuilds all visible water chunks together, so neighboring chunks cannot be lit at different times. **Flat** disables baked directional water shading entirely. |

**Hybrid border** is a compromise rather than a free win: it removes the cut exactly on
the chunk edge, but where the exact ring meets the hull interior you can still see a
one-tile stair. A 1-tile ring is the least intrusive; 2–3 tiles correct more of the hull
but make the border band visibly tile-based.

The same options can be opened directly:

```text
/?dev&terrain=polygon                      # boundary polygon terrain
/?dev&terrain=hybrid&ring=1                # hybrid border, 1-tile exact ring
/?dev&terrain=hybrid&ring=2                # hybrid border, 2-tile exact ring
/?dev&shading=world                        # world-sampled water shading + synced rebuilds
/?dev&shading=flat                         # flat water shading
/?dev&terrain=hybrid&ring=1&shading=flat   # both experiments
```

These flags are not persisted and are not part of the save file.

## Weather and lightning QA scenarios

`scripts/weather-smoke.mjs` forces clear night, stormy night, lightning, and a windy rain
frame, and asserts that the stormy night is measurably darker than the clear night.
Run it with:

```bash
webgame_smoke --scenario scripts/weather-smoke.mjs
```

`scripts/lightning-sun-smoke.mjs` freezes a night strike from the upper-left and checks
that the flash lights the scene, the cast-shadow vector points away from the strike, and
the headlamp is suppressed. It also samples the decay to prove the shadow vector and
headlamp state stay latched instead of tweening. It writes
`lightning-sun-before.png` and `lightning-sun-during.png` for side-by-side review:

```bash
webgame_smoke --scenario scripts/lightning-sun-smoke.mjs
```

## Where things are

| Path | Purpose |
|---|---|
| `index.html` | Single page; mounts the canvas and all UI layers |
| `main.js` | ES-module entrypoint → `modules/app.js` `initApp()` |
| `modules/app.js` | Main loop: update → fauna → camera → render → autosave |
| `styles/base.css` | CSS variables and all `@font-face` declarations |
| `fonts/` | Self-hosted fonts + Oswald OFL license |
| `webgame.config.json` | Headless smoke-test config (see [testing.md](testing.md)) |

Save data lives in `localStorage` under `cosy_current_save_v1`. It is origin-scoped, so
switching ports (e.g. 8080 → 8081) presents a fresh save. Use the in-game
**Delete Save Data** button to reset.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Blank page, console says "Failed to load module script" | Served with a wrong JS MIME type or opened via `file://` | Use `python3 -m http.server` and load `http://localhost:.../` |
| `Address already in use` | Another dev server on that port | Use a different port (`8090`, etc.) |
| Title renders in a generic fallback font | Font request blocked or wrong path | Confirm `fonts/` is served; `styles/base.css` uses `../fonts/...` |
| No save after restart | Different origin/port, or private browsing | Use the same URL; localStorage is per-origin |
| Canvas blank but UI visible | Game not started yet | Click **New Journey**; first chunks generate over a few frames |

## Verification status

Verified on 2026-11-12:

- `python3 -m http.server` served the page and module/font MIME types correctly.
- `webgame_check`: 0 errors, 0 external references.
- `webgame_smoke`: 10/10 checks passed in headless Firefox, no page/console errors,
  no external requests, canvas 100% painted after starting a journey.
- `.artifacts/webgame/<run>/final.png` contains the gameplay screenshot.
