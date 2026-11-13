# Testing

There is no unit-test framework, test runner, or test file in this project. Verification
uses the WebGame harness plus manual play. The automated checks are configured in
`webgame.config.json` and are intentionally strict: any external network request fails
the run.

## Automated checks

Run these from the project root (the DSH tools are available in this workspace):

| Check | What it does |
|---|---|
| `webgame_check` | Static pass: JS syntax, local imports, asset references, JSON, external URLs, readiness hook. Should report 0 errors and 0 external references. |
| `webgame_smoke` | Starts a server, loads the page in headless Firefox, waits for readiness, asserts the title, screenshots the start screen, clicks the start button, waits 2 s, asserts the main canvas is painted, and fails on page errors, console errors, HTTP errors, request failures, or external requests. |
| `webgame_shot` | One screenshot of the running page (start screen by default). |
| `webgame_runs` | Builds a pass/fail dashboard from previous runs under `.artifacts/webgame/`. |

`webgame_smoke` starts and stops its own static server; no manual server is needed.

### Readiness hook

`main.js` sets `window.__APP_READY__ = true` in a `requestAnimationFrame` callback queued
after `initApp()`, so screenshots wait for the first rendered frame instead of racing it.
`webgame.config.json` uses `"ready": "window.__APP_READY__ === true"`.

### Smoke steps

The config performs:

1. Assert the document title is `Cosy Current`.
2. Screenshot the start screen (`start-screen.png`).
3. Click `#btn-start` (labelled **New Journey**, or **Continue Journey** if a save exists).
4. Sleep 2000 ms to let chunks/fauna settle.
5. Assert `#main-canvas` has at least 1000 painted samples and take `gameplay.png`.

Expected output:

```
✓ Cosy Current — firefox <version>
  checks: 10/10 passed, 0 warning(s)
  canvas #main-canvas: ... painted=921600 (100.00%)
```

The run directory is printed in the output and contains `report.json`, screenshots, and a
failure screenshot if a step fails.

### Offline assertion

`expect.noExternalRequests` is `true`. A passing smoke run proves the page booted without
contacting any external host. `webgame_check` reports the static equivalent: 0 external
references across HTML, CSS, and JS.

## Manual checklist

After a change, load the game (see [development.md](development.md)) and check:

- [ ] Start screen renders with the bundled display fonts; **New Journey** button appears.
- [ ] Clicking **New Journey** hides the start screen and shows the river world.
- [ ] The raft drifts; `A`/`D` or arrow keys steer; mouse wheel zooms; middle-drag pans.
- [ ] Rain/weather, day–night tint, fauna, trees, and collectables animate without
      console errors.
- [ ] **Auto weather** produces a rain front on its own within a couple of minutes, then
      clears; the Rain/Wind sliders follow the live values while Auto is on.
- [ ] Touching Rain, Wind strength, or Wind direction switches the panel to **MANUAL**;
      ticking **Auto weather** hands control back to the simulation.
- [ ] **Strike lightning** flashes the scene; lightning only appears automatically in
      heavy rain, and the flash is brighter on the storm-bearing side. A jagged bolt
      appears on some strikes.
- [ ] Night + maximum storm is visibly darker than clear night. Compare
      `/?dev&time=0.95&rain=0` with `/?dev&time=0.95&rain=1&wind=0.7`.
- [ ] Water splashes are small flattened ripples, land splashes are tiny ticks, and
      forest floors have no ground splashes. Canopy impacts are small glints/drips that
      follow the tree lean.
- [ ] At high wind, trees lean downwind and sway; their shadows lean with them. At wind 0
      the trees are still. **Reduced motion** disables the sway but keeps the lean.
- [ ] **DEV** panel opens; speed, stop/start, cycle speed, weather controls, and the
      renderer experiment controls respond.
- [ ] The weather QA scenario passes:
      `webgame_smoke --scenario scripts/weather-smoke.mjs`.
- [ ] At fractional wheel-zoom levels there are no 1px black grid lines between chunks.
- [ ] In the dev panel, **Terrain** switches between Hull, Boundary polygons, and Hybrid border; **Hybrid ring** 1–3 changes the exact-tile band; **Water shading** switches between Baked / World-sampled / Flat. None of them throws or leaves chunk-edge background gaps.
- [ ] Settings modal opens/closes. Collection and Dock buttons open their modals.
- [ ] Reloading keeps the save (same URL/port); **Delete Save Data** resets it.
- [ ] Browser DevTools → Network shows only local files (no external hosts).
- [ ] Page still boots with the network disconnected.

## Known gaps

- No unit or integration tests for the simulation (noise, river steering, crafting,
  persistence). Regressions there are only caught by playing.
- Headless browser coverage is Firefox only in this workspace; Playwright/Chromium is not
  installed.
- The canvas check measures painted pixels, not visual correctness. `webgame_visual` is
  available for pixel-diff regression, but no baseline has been committed.
- Save data is origin-scoped, so tests start fresh on each port unless a save is seeded.
