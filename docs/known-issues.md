# Known issues

Issues found during the local-setup pass that were deliberately **not** fixed (to avoid
changing behavior or making product decisions). Severity is about impact on local
development, not on gameplay.

## MEDIUM — `page-init.js` is a dead jQuery stub that would crash if re-included

- **Evidence:** `page-init.js:3` starts with `$(window).ready(...)` and calls removed
  globals (`onPageLoad`, `initGame`, `generateMiniMap`, ...). It is not referenced by
  `index.html`, so it never runs today.
- **Impact:** None at runtime, but it is a trap: adding a `<script src="page-init.js">`
  tag would throw `ReferenceError: $ is not defined`. It also makes the project look
  like it still depends on jQuery.
- **Suggested fix:** Delete the file (the current code has no dependency on it), or move
  it under an `archive/` directory with a README note.

## LOW — Two bundled fonts are unused, and bundled-font licensing is undocumented

- **Evidence:** `fonts/BobloxClassic.ttf` and `fonts/FlappyFont.ttf` are not referenced by
  any `@font-face` or CSS rule (`grep -R "Boblox\\|Flappy"` only finds docs). All four
  original font files report an empty license field from `fc-scan`; there is no project
  `LICENSE` file. Only Oswald has a bundled license (`fonts/OFL-Oswald.txt`).
- **Impact:** ~67 KB of dead assets; uncertainty about redistribution terms for the
  original fonts. This is a provenance finding, not legal advice.
- **Suggested fix:** Confirm the source/license of each bundled font and record it in
  `docs/provenance.md`; delete fonts that are confirmed unused, or declare them if they
  are meant to be available.

## LOW — Saves are origin-scoped and have no migration path

- **Evidence:** `modules/persistence.js` stores one JSON blob under
  `cosy_current_save_v1`. `loadGame()` merges unknown data into defaults via
  `createAppState(savedData)`; there is no version field or migration step.
- **Impact:** Switching ports or hosts (e.g. 8080 → 8081) looks like data loss because
  `localStorage` is per-origin. A future save-schema change could silently discard
  fields. Not a setup blocker.
- **Suggested fix:** Use one stable dev URL/port for manual testing; if the schema
  changes, add a `saveVersion` and a migration in `persistence.js`.

## LOW — No automated coverage of simulation or persistence logic

- **Evidence:** No test framework, test files, or `package.json`. Automated checks only
  prove the page boots, the start button works, and the canvas paints.
- **Impact:** Noise, river steering, crafting, fauna behavior, and save/load regressions
  are caught only by manual play.
- **Suggested fix:** Add a small Node-based test harness for pure modules (`noise.js`,
  `persistence.js` merge logic, `crafting.js`) and keep gameplay checks manual.

## INFO — Credit mark is no longer a hyperlink

- **Evidence:** `index.html` keeps the local `sitcomreality.png` credit image but its
  `https://websim.com/@SitcomReality/` anchor was intentionally removed during setup so
  the page makes no external connections, even on click.
- **Impact:** The artist credit is not clickable; attribution text/image is preserved.
- **Suggested fix:** If a link is wanted later, make it opt-in and document it as the only
  outbound link, or point at a local credits page.
