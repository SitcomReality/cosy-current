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
