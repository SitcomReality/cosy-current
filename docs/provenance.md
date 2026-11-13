# Provenance

## Origin

- **Project:** Cosy Current — a gentle river-world simulator (canvas idle game).
- **Version in tree:** v0.2.0 Alpha.
- **Author / credit:** SitcomReality (local `sitcomreality.png` credit mark; original
  outbound WebSim profile link removed during setup).
- **Platform of origin:** WebSim. The inspector identified a WebSim credit link in
  `index.html`; no WebSim runtime scripts, sockets, or APIs remain in the code.
- **Repository:** `origin` remote is `https://github.com/SitcomReality/cosy-current.git`.
  Git history runs from 2025-11-30 (`v1`) through 2026-04-09 (322 commits), with the
  `v<number>:` commit convention. The working tree at setup time was clean except for an
  untracked `AGENTS.md`.
- **Import date:** Not recorded in the repo. The setup pass below is dated 2026-11-12.

## Original layout

Single-page static game: `index.html` → `main.js` → `modules/app.js`; modular Canvas
renderer under `modules/renderer/`; UI submodules under `modules/ui/`; static data under
`modules/data/`; CSS split into `styles/*.css`; bundled fonts in `fonts/`.

## Changes made during the local-setup pass (2026-11-12)

Behavior-preserving setup only; no gameplay, balance, save-format, or rendering changes.

1. **Removed the Google Fonts dependency.** Deleted the
   `https://fonts.googleapis.com/css2?family=Oswald...` `<link>` from `index.html`.
   Vendored the latin subset of the Oswald variable font as
   `fonts/Oswald-latin.woff2` and added a local `@font-face` in `styles/base.css`
   (`font-weight: 200 700`, latin `unicode-range`). Added the upstream SIL Open Font
   License text as `fonts/OFL-Oswald.txt`. Oswald was not referenced by any CSS rule in
   the original tree; it is now available as a local fallback in `--font-heading`.
2. **Removed the only outbound hyperlink.** The WebSim credit anchor in `index.html`
   became a non-link `<span>` around the existing local logo, preserving the credit while
   making the page fully offline. No external URL remains in HTML/CSS/JS.
3. **Fixed font URLs.** Changed `/fonts/...` (domain-root absolute) to `../fonts/...` in
   `styles/base.css`, so the game also works when served from a subdirectory.
4. **Removed a missing-asset reference.** `styles/components.css` referenced
   `coftbp.png`, which does not exist in the repo. Removed the `background-image` line;
   the element keeps its flat green background. The affected `.tc`/`.gt-*` tile classes
   are legacy and unused by current HTML/JS.
5. **Added an offline-safe favicon.** `<link rel="icon" href="data:,">` avoids a
   `/favicon.ico` 404 without adding a network request.
6. **Added a readiness hook and smoke config.** `main.js` sets `window.__APP_READY__`
   after the first frame; `webgame.config.json` drives `webgame_check`/`webgame_smoke`
   (start screen → click start → painted canvas, zero external requests).
7. **Added `.gitignore`** (OS/editor noise, `.env`, logs, `.artifacts/`, `node_modules/`,
   `*.code-workspace`).
8. **Documentation:** created `docs/development.md`, `docs/testing.md`,
   `docs/known-issues.md`, and this file; updated `AGENTS.md` to match the now-offline,
   verified local run path.

## Assets and licensing

| Asset | Origin | License status |
|---|---|---|
| `fonts/AldotheApache.ttf` | Bundled before setup | Not declared; no embedded license metadata found |
| `fonts/ChineseRocksRg.otf` | Bundled before setup | Not declared; no embedded license metadata found |
| `fonts/BobloxClassic.ttf` | Bundled before setup, unused by CSS | Not declared; no embedded license metadata found |
| `fonts/FlappyFont.ttf` | Bundled before setup, unused by CSS | Not declared; no embedded license metadata found |
| `fonts/Oswald-latin.woff2` | Google Fonts v57 (latin subset), downloaded during setup | SIL Open Font License 1.1 — `fonts/OFL-Oswald.txt` |
| `sitcomreality.png` | Bundled before setup (author credit logo) | Not declared; presumed author-owned, unverified |

No project-level `LICENSE` file exists. Licensing of the original bundled assets should
be confirmed by the author; see [known-issues.md](known-issues.md).

## Verification

See [development.md](development.md#verification-status) and
[testing.md](testing.md). Setup was verified with Python's static server and a headless
Firefox smoke run: no page errors, no console errors, no external requests, canvas
painted.
