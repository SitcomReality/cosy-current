# Cosy Current

A gentle river-world simulator — a canvas-based idle game where the player's raft drifts down procedurally generated rivers, collecting items and discovering wildlife.

## Play

Serve the directory over HTTP (no build step required):

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080/` in your browser.

Or use the Node.js server:

```bash
npx serve . -p 8080
```

**Note:** ES modules require serving over HTTP. Opening `index.html` directly via `file://` will not work due to CORS restrictions.

## Controls

| Action | Keyboard | Touch / Mobile |
|--------|----------|----------------|
| Steer Left | `A` / `←` | Drag left third of screen |
| Steer Right | `D` / `→` | Drag right third of screen |
| Collect Item | Click / Tap | Tap item |
| Gather (magnet) | Hold `Space` | — |
| Speed Boost | Hold `Numpad /` | — |
| Pause | `Esc` / Pause button | Pause button |
| Zoom | Mouse Wheel | Pinch (browser default) |
| Open Collection | Click 📖 | Tap 📖 |
| Open Dock | Click ⚓ | Tap ⚓ |
| Settings | Click ⚙ | Tap ⚙ |

## Gameplay

- **Drift:** Your raft automatically follows the river. Steering is optional — the autopilot handles navigation.
- **Collect:** Items float downstream. Tap/click them, or let auto-collect grab them when close. Hold `Space` to magnetically pull in nearby items.
- **Discover:** Find 4 relics (Ancient Coin, River Gem, Message in a Bottle, Broken Compass) to reach the ending. A hidden discovery meter guarantees you'll find them all.
- **Customize:** Spend materials at The Dock to change your raft's hull, cabin, roof, and light.
- **Relax:** No fail state, no timer, no pressure. Play on a second screen while watching a movie.

## Features

- Procedural infinite river world (simplex + Perlin noise, domain-warped)
- Day/night cycle (~5 min per day) with dynamic shadows and lighting
- Dynamic weather (rain, wind, lightning) driven by noise, with wind-reactive trees, surface-aware splashes, and lightning that briefly acts as the scene's sun
- Living ecosystem: fish, birds, deer, crabs, fireflies, sheep, turtles, eels
- Natural landmarks: fallen trees, rock arches, hot springs, river confluences
- 8 collectable materials + 4 relics
- 31 raft customization parts across 7 categories
- Procedural WebAudio ambience (river, rain, wind, birds, fireflies)
- Full offline support — no network requests, all assets bundled
- Save/load via localStorage (persists position, inventory, relics, settings, zoom, time)
- Mobile-friendly: touch steering, tap collection, responsive layout

## Visual Style

Everything is drawn with straight, rigid lines — no curves, no smooth arcs, no bezier paths. Shapes are polygons built from `lineTo` calls. This gives the game a distinct, hand-hewn visual identity.

## Tech Stack

- Vanilla JavaScript (ES modules) — no transpilers, no TypeScript
- HTML5 Canvas 2D (`alpha: false`)
- CSS3 with custom properties, self-hosted fonts
- No dependencies, no build step, no package.json
- Runs fully offline

## Testing

```bash
# Static checks (syntax, imports, assets, external URLs)
webgame_check

# Headless browser smoke test
webgame_smoke
```

## Credits

**Created by** SitcomReality

**Fonts**
- Aldothe Apache — Aldothe
- Chinese Rocks — Ray Larabie
- Oswald — Vernon Adams (SIL OFL 1.1, see `fonts/OFL-Oswald.txt`)

**Tech:** Vanilla JS + Canvas 2D, no build step, no dependencies.

## License

MIT License — see [LICENSE](LICENSE).