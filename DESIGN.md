# Terra Gen: Idle Realm – Design Notes

## 1. Reconstructing the Original Intent

From the remaining code and styles, the original game likely combined:

- Procedural world generation
  - Noise-based terrain (perlin/simplex/other variants).
  - Map made of tiles rendered as DOM elements (`.tr`, `.tc`, `.gt-*`).
  - A minimap (`#minimap`) and map overlay (`#mapoverlay`, `#cloudlayer`, `.fx_cloud`, `.cloudpart`).

- Simple simulation on top of that world
  - NPCs as "actors" (`.actor`) moving across tiles.
  - Coins and money UI (`.coin`, `.coin_text`, `.coin_glimmer`).
  - Controls to move the visible window around the world:
    - Buttons like `.btn_move` with directions.
    - Generation of new rows/columns (`generateTileRow`, `generateTileColumn`).
  - The game loop driven by timers and DOM mutation, with jQuery wiring (`page-init.js`).

- Management / idle elements
  - Funds and some form of income (coins, maybe tile-based resources).
  - Population associated with cities or settlements.
  - The idea of an "idle" progression where the world continues and generates value while mostly hands-off.

- A tinkering / sandbox vibe
  - Many noise settings and different algorithms to experiment with.
  - Sliders/inputs in the old minimap controls for generation parameters.
  - The current settings modal for terrain algorithm, scale, and evolution speed continues that idea.

## 2. What Remains Now

After refactors and moving to canvas:

- Core systems
  - Noise:
    - Centralized `createNoiseEngine` with multiple algorithms and FBM.
  - World:
    - `getTile(x, y)` maps noise values to tile types (water, sand, grass, forest, mountain).
  - Entities:
    - NPCs wander randomly.
    - Cities increase population and generate funds over time.

- Rendering and UI
  - Fullscreen canvas for the world (`canvas.js`).
  - Camera movement via WASD/arrow keys.
  - Start screen with a strong visual identity and "Initialize World" action.
  - In-game HUD tracking funds and population.
  - Settings modal for terrain generation parameters.

- Missing or weakened pieces
  - No explicit way for the player to place cities or interact with tiles.
  - No clear goal, progression, or feedback loops.
  - NPCs exist visually, but do not affect the world or player decisions.
  - Some legacy UI concepts (minimap, clouds, coins) are visually present in CSS, but not used in the current flow.

## 3. A Coherent Direction for a Compelling Little Game

### 3.1 Core Fantasy

- You are a low-key "realm gardener" overseeing a tiny generated world.
- Your realm slowly develops as population grows, small cities appear, and NPCs wander.
- You nudge the world rather than micromanage it:
  - Place city seeds.
  - Unlock new regions.
  - Tweak the underlying "rules" of terrain and evolution.

The tone is relaxed, atmospheric, and experimental: watch your world unfold, poke it occasionally, and see what happens.

### 3.2 Pillars

- Simple but expressive:
  - Few systems, but they visibly interact (terrain, cities, NPCs, funds).
- Low friction:
  - No complex menus, no micro-UI.
  - Most interactions are tap/click plus a few sliders.
- Observable feedback:
  - Any action the player takes should create a visible, immediate effect in the world.
- Idle-friendly:
  - Funds and population grow over time.
  - World feels "alive" even when you are not constantly interacting.

### 3.3 Player Loop

A compact core loop could look like:

- Observe:
  - Watch the terrain, NPCs, and existing cities.
  - See funds and population numbers tick upward.
- Act:
  - Spend funds to place a new city on appropriate tiles.
  - Use simple tools to modify generation (e.g., change terrain scale or algorithm).
  - Maybe unlock or reveal new regions of the map.
- React:
  - See NPCs cluster around cities.
  - Watch terrain variations influence where cities thrive.
  - Unlock passive bonuses that change the balance of income or growth.
- Progress:
  - Reach soft milestones (total population, number of cities, explored area).
  - Unlock cosmetic or minor functional changes to the world and UI.

## 4. Suggested Mechanics Built on the Existing Code

### 4.1 Terrain and Tiles

Keep:
- Noise-based generation, using the current `getTile` as the canonical terrain.
- Camera-based infinite world feel (scroll anywhere, tiles are generated on demand).

Clarify:
- Which tiles are valid for city placement:
  - Cities can only be placed on grass or forest.
- Which tiles shape NPC behavior:
  - NPCs prefer walking on grass and forest.
  - Mountains and water are slower or blocked.

Extend:
- Add a "region" or "biome" concept:
  - Not necessarily a new data structure, but thresholds in noise that define "coastal", "inland", "mountainous".

### 4.2 Cities, Funds, and Population

Keep:
- Cities generate funds over time: `funds += cityCount * dt * 10`.
- Population is tied to cities.

Extend:
- City placement:
  - Add a simple tool:
    - Tap/click a tile to place a city if:
      - The tile is valid (e.g., grass or forest).
      - You have enough funds to pay the placement cost.
  - This gives a clear, satisfying decision point.
- City scaling:
  - Each city has a level:
    - Level 1 city: small income, small population.
    - Level increases automatically or via purchases, boosting both.
- Distance-based reward:
  - Remote cities (farther from the starting camera position) give slightly higher yields:
    - Encourages exploration and camera movement, keeping the idle loop from being purely static.

### 4.3 NPCs as Ambient Life and Signals

Keep:
- NPCs wandering randomly for now.

Refine:
- Use NPCs as visual indicators, not a complex simulation:
  - NPCs spawn near cities, proportional to city level or population.
  - NPCs slowly drift into nearby suitable terrain; avoid water and mountains.

Future expansion (optional):
- NPCs occasionally "discover" a good spot:
  - They can mark potential city locations.
  - If you fund it, their "camp" turns into a small city.
- Let NPC density subtly affect funds or bonuses:
  - High NPC density near a city could mean more income or a chance of a special event.

### 4.4 World Manipulation and Settings

Leverage the existing settings modal:

- Maintain the "lab" feel:
  - Terrain algorithm, scale, and evolution speed already exist.
- Tie settings into progression:
  - Some sliders locked until you reach certain population or funds thresholds.
  - Changing generation parameters could:
    - Re-roll far-away regions, leaving existing city areas stable.
    - Influence where new resources or city sites appear.

This keeps the more technical generation options but frames them as "Realm Tuning" tools rather than low-level developer knobs.

## 5. UI and UX Direction

### 5.1 Screens

- Start Screen:
  - Present the core fantasy: "Generate a new realm" instead of just "Initialize World".
  - Optionally show a "Last Realm" summary if persistence is added later.

- Main Game Screen:
  - Fullscreen canvas as main stage.
  - HUD:
    - Top: funds and population (current).
    - Bottom: minimal controls:
      - City placement toggle.
      - Button to open settings ("Realm Tuning").
      - Tiny hint for camera movement.

### 5.2 Interactions

- Tap / Click:
  - While in "City Placement" mode:
    - Tap a tile to attempt to place a city.
    - If invalid or insufficient funds, show a subtle, non-intrusive message.

- Camera:
  - Continue to use WASD/arrow keys for desktop.
  - Consider simple drag-to-pan for touch (future extension).

- Settings:
  - Short labels focused on meaning, not implementation:
    - "Terrain Detail" for scale.
    - "World Drift" for evolution speed.
    - "Pattern Style" for noise type (Perlin, Simplex, etc.).

## 6. Scope and Priorities

To keep the project focused and shippable as a "fun casual little idle game", prioritize:

1. Make one satisfying core action:
   - Placing and watching cities grow and generate funds and population.
2. Make the world visually readable:
   - Distinct tile types, clear city markers, subtle NPC glows.
3. Integrate UI and mechanics tightly:
   - Every UI element has a clear mechanical reason to exist.

Defer or keep optional:
- Complex economy or resource chains.
- Detailed NPC AI or social models.
- Deep tech-tree style upgrades.

With this direction, Terra Gen: Idle Realm becomes a small, atmospheric city-seeding and world-tweaking toy, where you watch your generated realm thrive with minimal friction and a few meaningful nudges.