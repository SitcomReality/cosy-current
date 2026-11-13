# Cosy Current — v1.0 Completion Goal

**Status:** Intended goal — not yet implemented  
**Target release:** v1.0 "toy finish"  
**Target session:** ~90 minutes, movie-length, second-screen  
**Owner:** SitcomReality  
**Last updated:** 2026-11-14  
**Related:** [development.md](development.md) · [testing.md](testing.md) · [known-issues.md](known-issues.md)

## Why this document exists

Cosy Current's look, world, and atmosphere are already finished. What is missing is a
contract with the player: a reason to keep going, visible progress, and a moment that
says "you did it." This document defines what **finished** means for v1.0 so development
can stop at a defensible line instead of expanding indefinitely.

It is a scope document, not a wish list. If a change does not move the game toward the
definition of done below, it is out of scope for v1.0.

## Terminology

- **Relic** — one of the four collectable treasures that form the ending track: Ancient
  Coin, River Gem, Message in a Bottle, Broken Compass.
- **Relic marker** — the separate decorative `ENTITY_RELIC` scenery entity (orange
  triangle plus influence ring). It is not a collectable and is under review alongside
  cities.
- **City** — the decorative `ENTITY_CITY` scenery entity (green square plus influence
  ring). Under review.

## Definition of done

A first-time player can, without reading the source or a wiki:

1. **Understand the loop within 30 seconds** — drift, tap, collect, optionally spend.
2. **See the goal and their progress** — a four-relic counter and a clear next step.
3. **Play through the four-relic journey and reach the ending in ~90 minutes** of
   low-attention play — roughly the length of a movie, with the game on a second screen.
4. **Find something to return to** — credits, then a free-play state that still has
   materials, Dock parts, and upgrades left to pursue.
5. **Leave and return without losing the thread** — position, inventory, relic discoveries,
   discovery-meter progress, raft, clock, zoom, volume, and ending flag survive a reload.
6. **Play with sound**, with no dev tools or placeholder screens — on a laptop now, and on
   a phone if mobile is in scope.

The release itself is clean: no empty modals, no DEV panel in the normal build, no dead
entrypoints, a README and license, and a stable public URL.

**The v1.0 promise:** a small, complete, movie-length cosy game — not a bigger one.

## Design principle: movie-length, second-screen

The target player is watching a movie on one screen and occasionally glancing at Cosy
Current on another. They tap an item, look back at the film, and return a minute later.
This is a design constraint, not just a session-length target.

- **Auto-drift and auto-collect are the default.** The raft must make progress if the
  player never touches the controls.
- **No fail state, no timer pressure, no precision requirement.** Looking away must never
  cost the player anything.
- **Every required action is a tap, not a sustained input.** Steering, gathering, and Dock
  optimisation are optional enhancements for players who lean in — never requirements for
  the ending.
- **Readable at a glance.** Silhouettes, a relic counter, and sparse text. No mechanic
  should require reading while the raft is moving.
- **The ending must be reachable in this play pattern.** The free-play long tail is for
  players who choose to engage more, not a gate in front of the credits.
- **The discovery meter must fill from passive pickups**, not from precise play, so a
  low-attention player still sees all four relics.

This principle should settle most pacing and input debates: if a change makes the game
worse when glanced at, it is probably wrong for v1.0.

## The shape of a finished session

```
A ~90-minute, movie-length session on a second screen:
Start at dawn
  → learn the controls in the first 30 seconds
  → first pickup within seconds; first relic around 10 minutes
  → relics at a steady, guaranteed cadence; the Dock is available but optional
  → the fourth relic around 75 minutes
  → the river opens, the raft beaches, credits
  → free play still has materials, Dock parts, and upgrades
```

The game does not need chapters, cutscenes, or a plot. It needs a beginning, a middle with
visible accumulation, and an ending that acknowledges what the player did — and it must
survive being glanced at rather than stared at.

## Resolved decisions

These are settled; do not reopen them without a direct request.

1. **Ending length:** ~90 minutes, the length of a movie, played on a second screen with
   occasional taps.
2. **Ending condition:** the **four relics only**. No Dock purchase, no material
   completion, no "unlock every swatch." Materials, Dock parts, and upgrades remain as
   free-play goals after the credits.
3. **Audio:** procedural WebAudio, synthesised in the browser. No bundled audio files.
4. **Relic count:** four for v1.0. The material catalogue may grow later without changing
   the ending condition.

## Priority key

- **P0 — required.** Without these, v1.0 is not finished.
- **P1 — required for feel.** These are what make it feel like a release rather than a
  prototype. They may be cut only by explicitly moving them to a post-1.0 list.
- **P2 — release hygiene.** Cheap, mostly mechanical, done last.

---

## P0.1 — Completion and ending

- [ ] **Define and persist the ending condition.**
      Condition: all **four relics** discovered (Ancient Coin, River Gem, Message in a
      Bottle, Broken Compass). Materials and Dock purchases are **not** required. The
      ending should feel like the river has shown you everything it has to hide, not like
      you finished a checklist.
      *Done when:* `state.collection` can evaluate the four-relic condition, and a boolean
      `endingSeen` survives saves.

- [ ] **Make the relic collection legible.**
      Show `n / 4 relics` in the Collection modal and on the HUD once the first relic is
      found. Replace the four identical "?" cards with silhouettes or one-line hints
      ("A relic of the forest", "Something lost on the bank"). Use the existing item
      sprites instead of flat colour squares. Material counts can still be shown, but they
      do not gate the ending.
      *Done when:* a player can tell which relics they have, which are missing, and roughly
      where to look without opening the source.

- [ ] **Write and build the ending sequence.**
      When all four relics are found: a short fade, the river widening into a sea/horizon,
      the raft coming to rest, two or three lines of quiet text, credits, and a
      **Keep Drifting** button that returns to free play with the save intact.
      *Done when:* the ending can be triggered from a seeded/short test in under three
      minutes, and a normal low-attention run reaches it in ~90 minutes. It is replayable
      via New Journey.

- [ ] **Add a relic counter to the HUD.**
      A small, non-intrusive counter (e.g., `3/4 relics`) that appears after the first
      relic, plus a one-time nudge when only one remains. This is the player's main
      progress signal at a glance.
      *Done when:* the player never has to open a modal to know they are near the end.

- [ ] **Free play after the ending.**
      Keep the world running, keep saving, and leave the Dock open. Materials, parts, and
      upgrades remain to pursue; optionally mark completed parts with a subtle check.
      *Done when:* the player can keep playing indefinitely after credits without a reset,
      and the save still shows the ending as seen.

**Acceptance:** a save seeded with 3 of 4 relics can reach the ending in a short session;
the credits return to a playable world; the state is saved and restored.

---

## P0.2 — Reachability and the relic path

The ending now depends on four relic discoveries, and the current spawn table makes the
rarest of them unreachable (see [Baseline](#baseline-current-state)). The relic path must
be guaranteed. Materials and Dock costs are free-play tuning; they do not gate the ending.

- [ ] **No relic may be gated behind pure chance.**
      Every undiscovered relic must have a guaranteed path within a bounded time. The
      preferred implementation is a **discovery meter**: each pickup (auto-collected or
      tapped) fills a meter; when full, the next spawn is a guaranteed undiscovered relic
      placed on the raft's projected course. Reset the meter after the discovery. The meter
      can be quiet or invisible; the HUD relic counter is the player-facing progress. Once
      all four relics are found, the meter retires (or converts into a small material
      bonus).
      *Done when:* a player who keeps playing will see all four relics even with unlucky
      rolls. Expected pacing: first relic at 8–12 minutes, all four by ~75 minutes.

- [ ] **Use context-sensitive spawns for texture, not as the guarantee.**
      The spawn pool should depend on tile type, time of day, and weather, so the world's
      systems become mechanics: bottles in rain, compasses in forest at dawn, fireflies and
      rare glimmers at night, coins on banks after dusk. Keep common materials common.
      These rules add flavour and optional agency; the discovery meter is what protects the
      ending from bad luck.
      *Done when:* a player can deliberately fish a riverbank or wait for rain to improve
      their odds, and the collection descriptions match where items are found.

- [ ] **Set and enforce a completion budget.** See
      [Completion budget](#completion-budget) for the targets and the current material
      totals.

- [ ] **Make relics visible and reachable.**
      Rare spawns currently appear 26–51 tiles ahead (mostly off-screen at default zoom) or
      60–160 tiles away on the rare branch, where they can be culled at 150 tiles. Put
      guaranteed relics on the projected course, add a visible marker (a light shaft, a
      ring, a sound cue), and make sure a raft at normal speed can reach them — ideally
      within the auto-collect path or a single tap.
      *Done when:* a marked relic is always reachable before it despawns, even if the
      player never steers.

### Completion budget

| Goal | Target | Gates the ending? |
|---|---:|---|
| First pickup | < 10 seconds | no |
| First relic | 8–12 minutes | no |
| All four relics | ~75 minutes | **yes** |
| Ending | ~90 minutes | — |
| First Dock purchase (optional) | < 15 minutes if the player engages | no |
| All materials + 31 Dock entries (24 non-default unlocks; free play) | 4–6 hours | no |

The ending requires no Dock purchase, so the current catalogue cost — 315 wood, 140
plastic, 65 cloth, 105 scrap, 2 ancient coins, 2 river gems — is the **free-play long
tail**, not the ending budget. Treat it as a starting point. The four relics must be
guaranteed first; the material economy can be tuned afterwards. If the long tail feels
grindy, reduce costs or increase yields, but do not let that tuning delay the ending.

*Done when:* an instrumented run reports time-to-first-pickup, time-to-first-relic,
time-to-fourth-relic, and time-to-ending, and those numbers are inside the targets.

**Acceptance:** a 30-minute instrumented run discovers at least two relics; a 90-minute
run discovers all four and triggers the ending; no relic should require more than ~25
minutes of engaged play, and the four together should land by ~75 minutes.

---

## P1.1 — A build, not just paint

- [ ] **Add three or four functional upgrades** alongside the cosmetics, each with a
      visible effect and a tradeoff or clear benefit:
      - **Magnet** — larger auto-collect radius.
      - **Lamp** — larger/night-specific light radius; reveals rare glimmers.
      - **Shallow-draft hull** — can cross banks/side channels slowly.
      - **Current-reader / speed** — a modest speed increase, or better steering authority.
      Costs use the same materials as cosmetics. These are **free-play progression**: they
      make the Dock worth opening, but the ending does not require them.
      *Done when:* the player can feel the difference in play after buying each one, and
      the Dock remains fully optional for the four-relic ending.

- [ ] **Make the Dock discoverable but not mandatory.**
      A low-attention player can finish the ending without ever opening it. For players who
      do open it, the first affordable purchase should be obvious within ~15 minutes.
      *Done when:* the Dock is reachable in one tap, and the ending does not depend on it.

- [ ] **Polish the Dock.**
      Show **all** cost entries (not just the first), human-readable names instead of raw
      IDs (`Ancient Coin`, not `ANCIENT_COIN`), an explicit **Owned / Equipped /
      Affordable** state, and a disabled look when unaffordable. Replace the preview's
      `arc()` water circle with a straight-line polygon (the project's visual rule), and
      scale the raft so it fills the preview. Show the selected light type/colour and a
      simple beam.
      *Done when:* no Dock item can surprise the player with a hidden cost, and the
      preview looks like it belongs to the same game as the world.

---

## P1.2 — Moment to moment

**Play-pattern constraint:** the default experience is a movie-length second-screen drift.
The raft auto-steers and auto-collects; the player should be able to glance over every
30–60 seconds, tap once, and look back. Active steering and gathering are optional
enhancements, never requirements.

- [ ] **Spawn items in a readable trail.**
      Narrow the fan, and guarantee that a meaningful share of spawns land within a few
      tiles of the raft's projected course. The passive player should see a reason to tap,
      not a lottery spread across the whole screen.
      *Done when:* in a 60-second no-input run, several items pass within reach; when a
      guaranteed relic is placed on the course, it can be auto-collected or tapped without
      steering.

- [ ] **Make collection tactile.**
      Enlarge the click/tap target (≥28 CSS px at default zoom, ≥44 px on touch), add a
      hover/pulse affordance and a pointer cursor, and keep the magnet animation. Add an
      optional **Gather** action (hold or Space) that pulls nearby items in, with a short
      cooldown or an upgrade. Fix the high-DPI hit test: compare CSS-pixel click
      coordinates with the CSS-pixel `state.width`/`height` used for rendering, instead of
      dividing by `state.pixelRatio`.
      *Done when:* a first-time player can collect an item by tapping it on the first try,
      at 1× and 2× device pixel ratios, and a passive player never needs to.

- [ ] **Offer optional steering authority.**
      A/D (and touch drag/tap) should be able to hold a line toward a side item for a
      second or two before the autopilot resumes, with visible rudder/turn feedback. Keep
      the autopilot as an assist: the default drift must still work if the player never
      touches the controls.
      *Done when:* an engaged player can reach a bank item without fighting the autopilot,
      and a passive player still reaches the ending.

- [ ] **Frame the first minute.**
      Start one zoom step closer (48 or 64 rather than 32), remember the player's zoom,
      and add two or three very short, non-blocking prompts: tap to gather, follow the
      relic counter, the anchor opens the Dock. Dismiss them on first tap; never block the
      drift with a modal.
      *Done when:* a player who has never seen the game can collect an item and knows the
      relic goal within 60 seconds, while a player who ignores the prompts still progresses.

---

## P1.3 — The frame around the game

- [ ] **Title screen:** New Journey, Continue Journey, Settings, Credits. Keep the
      existing logo and credit mark. Set the expectation: a movie-length, low-pressure
      drift; no fail state, no timer. Make the version label a real version.
- [ ] **Pause menu:** Esc or a HUD button. Resume, Settings, Abandon Journey (confirm),
      Return to Title. Pause simulation while open; keep the last frame visible.
- [ ] **Settings:** master volume, mute, reduced motion, text size. Remove the empty
      "Generation Settings" modal or replace it with these controls. Persist settings.
- [ ] **Credits:** author, bundled font attributions, a short thank-you. Keep it local
      (no external links) to preserve the offline rule, or use a local credits page.
- [ ] **Remove DEV from the release build.** Keep it behind `?dev=1` (or a local flag) and
      document it as developer-only. The normal HUD should show only the relic counter,
      collection, Dock, settings, and pause controls.
- [ ] **Never ship a blank modal.** If a screen has no content, remove the entry point.

**Acceptance:** no placeholder UI remains; Esc pauses; settings and volume persist; the
normal build has no DEV panel; the title screen communicates the movie-length, low-pressure
play pattern.

---

## P1.4 — Sound

- [ ] **Add procedural WebAudio ambience (decided).** Synthesise everything in the
      browser; add no audio files. Layers: a river bed, a rain layer tied to
      `precipIntensity`, a wind/foliage layer tied to `wind`, occasional daytime birds,
      night fireflies/chimes, a soft pickup note (pitch rising with a short combo), a UI
      click, and a completion chord.
- [ ] **Respect browser autoplay rules:** initialise on the first gesture (the New Journey
      click is enough), default volume low (~30–40%), persist mute/volume, and stop/resume
      cleanly on pause.
- [ ] **Keep it subtle and glanceable.** The game may be playing under a movie or podcast;
      avoid sudden loud peaks and attention-grabbing stings; no audio-only cue should carry
      required information.

**Acceptance:** audio initialises without console errors; mute and volume work and persist;
no network requests; the game is noticeably cosier with sound on, and unobtrusive at low
volume.

---

## P2 — Release hygiene

- [ ] **Touch and responsive layout (if mobile is in scope; recommended).** Drag/tap
      steering; one-thumb play; bottom bar wraps; modals fit 390×844; inventory pills wrap
      or collapse into a compact counter; no hover-only affordances.
- [ ] **Save version and migration.** Add `saveVersion: 2`, migrate old saves, persist
      `dayTime`, zoom, volume/mute, `endingSeen`, `onboardingSeen`, discovery-meter
      progress, and settings. Stop resetting `dayTime` to 0.25 on Continue.
- [ ] **Fix the inventory pill overflow** when all eight item types are present.
- [ ] **Use the real item sprites** in Collection cards and the HUD, not flat colour
      squares; show counts and discovery state.
- [ ] **Clean the tree:** delete `page-init.js`, remove unused fonts
      (`BobloxClassic.ttf`, `FlappyFont.ttf`) or document why they stay, and record font
      licences.
- [ ] **Add a README** (what it is, how to run, controls, credits), a LICENSE, a favicon,
      a meta description/OG image, and a 20-second GIF.
- [ ] **Deploy to a stable URL** (GitHub Pages or itch.io) and verify the deployed build
      with `webgame_check` + `webgame_smoke`.
- [ ] **Keep the existing checks green** throughout: `webgame_check` 0 errors / 0 external,
      `webgame_smoke` 10/10 checks.

---

## Verification

### Automated

Extend `webgame.config.json` and the smoke scenario to cover the new surface:

1. Title → New Journey → HUD.
2. Open Collection → Relics tab: assert four relic cards and the `n / 4` counter; assert
   material cards still render on the Flotsam tab.
3. Open Dock: assert 7 categories and 31 parts; assert every part shows a cost or
   "Owned"; assert the preview canvas is painted. This is free-play coverage, not the
   ending path.
4. Open Settings: assert volume/mute/reduced-motion controls exist.
5. Press Esc: assert the pause menu appears and the simulation is paused.
6. Screenshot each screen; no page errors, console errors, or external requests.

Add a **balance check** that is not a unit test: a small browser scenario driven by a
dev-only debug hook (not shipped), or a Node script run with the project's ESM settings,
that simulates ~90 minutes of low-attention play and prints time-to-first-pickup,
time-to-first-relic, time-to-fourth-relic, and time-to-ending. Keep it under `scripts/` or
`.artifacts/`; it is development tooling, not a shipped dependency.

### Manual

- **First-time player test:** someone who has not seen the game starts it, and within
  60 seconds can collect an item and knows the four-relic goal. Steering and the Dock are
  optional.
- **Second-screen test:** put a movie on another screen, glance at Cosy Current every
  30–60 seconds, and tap occasionally. The relic counter must advance and the ending must
  remain reachable without sustained attention.
- **Completion test:** play (or fast-forward) to the ending in ~90 minutes; confirm
  credits, free play, and that the save survives a reload. Free play must still show
  uncollected materials, unpurchased Dock parts, and upgrades.
- **Persistence test:** reload after changing clock, zoom, volume, and inventory; relic
  discoveries and discovery-meter progress should be restored.
- **Phone test (if mobile is in scope):** 390×844, one-thumb touch steering, tap
  collection, modals scroll, no clipped HUD.
- **Offline test:** load and play with the network disabled; no external requests.

---

## Milestones

| Milestone | Work | Exit criteria |
|---|---|---|
| **M1 — Reachability** | Discovery meter, context spawns, relic counter, economy tuning | A 30-minute run finds ≥2 relics; a 90-minute run finds all four |
| **M2 — Completion** | Four-relic ending condition, ending sequence, credits, free play, save flags | Seeded test reaches the ending; a normal low-attention run reaches it in ~90 minutes; free play retains Dock goals |
| **M3 — Feel & frame** | Build upgrades, moment-to-moment fixes, title/pause/onboarding/settings, Dock/relic polish | First-time and second-screen playtests pass; no placeholder UI; high-DPI tap works |
| **M4 — Audio & release** | Procedural WebAudio, touch, save migration, README/LICENSE, deploy, GIF | Checks green; deployed URL works; phone + offline tests pass |

Each milestone ends with `webgame_check`, `webgame_smoke`, and a short manual playtest.

---

## Non-goals

Explicitly out of scope for v1.0:

- The three-reach journey with chapter choices, story beats, and a landmark progression
  system. This is the post-1.0 ambition; it is a different, larger game.
- Requiring Dock completion, all materials, or every raft part to see the ending. The
  ending is four relics; everything else is free play.
- New biomes, fauna, weather types, or a large material-catalogue expansion. The
  atmosphere is already the finished part; more of it will not make the game feel complete.
- A human-settlement layer — NPCs, trade, crowds, farms, roads — in v1.0. The existing
  "city" entity is under review and may be removed; see
  [Cities and the man-made world](#open-design-question-cities-and-the-man-made-world).
- A backend, accounts, multiplayer, analytics, or cloud saves.
- A renderer rewrite or WebGL migration.
- Localization.
- Monetization of any kind.

If an idea is not on this page, it waits.

---

## Open design question: cities and the man-made world

The project's first prototype used little squares on the shore to indicate "cities." That
placeholder has been fraught ever since, because the word *city* implies a human
settlement: people, buildings, roads, farms, trade, a scale far larger than the raft. The
rest of the game deliberately depicts none of that. Apart from the player's raft (and the
handful of small collectables), the world has no man-made structures at all.

The current city entity is a green tile-sized square plus a jagged ~20-tile influence ring.
It reads as an abstract zone, not a place. At the default 32 px/tile zoom, a credible city
would be enormous; at any zoom, it raises the question of where all the people are. This is
not a blocker for the 90-minute, four-relic ending — cities are decorative today — but it
is a coherence problem for the world, and it should be decided rather than left as ambient
weirdness.

The relics already imply people: a coin, a bottle, a compass (the gem is natural). They
work because they are small, decontextualised traces, not settlements. Any city-scale
feature has to earn the same kind of acceptance.

### Options

| Option | What it means | Cost | Risk |
|---|---|---|---|
| **A. Remove cities** | Delete the city entity, its spawner, renderer, and influence rings. Keep the decorative relic markers, or fold them into option B. | Low | None. Simplifies the world and the scope. |
| **B. Natural landmarks** | Replace cities with giant fallen trees, rock arches, hot springs, river confluences, nesting grounds. Use them as scenic anchors or relic spawn points. | Medium | Needs art and a new name; may overlap with relics as "special places." |
| **C. Ancient traces** | Ruins, a broken bridge, a single tower, a shrine. Imply people without depicting a settlement. | Medium–high | The scale/lore question persists: who built it, where did they go, why is it here? |
| **D. Distant silhouettes** | Cities only on the horizon, never entered, purely atmospheric. | Low | Adds no gameplay; still implies a world the game does not simulate. |

### Recommendation

For v1.0, choose **A (remove)** or **B (natural landmarks)**. Do not spend v1.0 time
building a city system; the four-relic ending does not need one.

- If **A**: delete the city entity type, its spawn logic, its renderer, and the influence
  rings; keep the four collectable relics as the authored discoveries. Decide separately
  whether the decorative relic markers stay. Update `AGENTS.md` and the docs.
- If **B**: rename the entity to "landmark," give it a natural silhouette at the raft's
  scale, and use it as a scenic waypoint or a guaranteed relic anchor. It can remain
  non-interactive in v1.0.
- If **C**: write the lore rule first — why the traces are ancient, why no people are
  present, and what the player can do there. If the answers are not immediate, cut it.
- If **D**: treat it as set dressing and do not build interaction around it.

**The burden of proof for keeping cities:** what does a city add at the raft's scale that a
natural landmark or a relic does not? Who built it, where are they, and why is the player
passing through? If those answers are not immediate, cut it.

**Scale contract if any man-made feature stays:** it must read as a silhouette or a small
cluster at 32–64 px/tile; it sits on the bank or in the forest, not in the river; it has a
single clear purpose (scenic, docking, discovery, or trade); and it does not imply a
population the simulation cannot support.

---

## Open decisions

1. **Mobile:** required for v1.0 (recommended — it is a web game, and one-thumb play suits
   the second-screen pattern) or post-1.0?
2. **Dock access:** available anywhere (current, recommended for the toy finish) or only at
   landmarks? This may change if cities become natural landmarks.
3. **Cities:** A, B, C, or D above? Recommendation: A or B for v1.0; C only with a lore
   rule; D only as scenery.
4. **Day length:** the current cycle is ~100 seconds, so a 90-minute session spans roughly
   54 day/night cycles. Is that the intended rhythm, or should days be longer so the light
   changes less often? This is a mood question, not an ending blocker.
5. **Material catalogue:** keep the four materials for v1.0, or expand them in free play?
   This does not affect the four-relic ending.

---

## Baseline (current state)

Evidence for the requirements above; not a separate task list.

### Spawn economy

At 2 spawn attempts/second, with `rarity^2.5` weighting and the current tile rules:

| Item | Share of picks | Valid spawn ground | One spawn event every |
|---|---:|---:|---:|
| Driftwood | 49% | 20% | ~5 s |
| Tattered Cloth | 28% | 6.8% | ~26 s |
| Rusted Scrap | 14% | 13.5% | ~27 s |
| Hard Plastic | 8.7% | 6.8% | ~85 s |
| Message Bottle | 0.16% | 22% | ~24 min |
| Ancient Coin | 0.089% | 6.8% | ~2.3 h |
| Broken Compass | 0.043% | 40% | ~48 min |
| River Gem | 0.027% | 4.5% | ~11.5 h |

"Valid spawn ground" is the fraction of positions around the raft that satisfy the item's
tile/depth rule. These are spawn events, not pickups; rare items usually appear off the
raft's course.

### Current gaps

- Collection is 4 materials + 4 relics. The four relics are now the ending track; the
  Relics tab is four identical "Unknown" cards with no counts, hints, or completion state.
- Cities are green squares plus abstract influence rings, and the decorative relic markers
  are orange triangles with the same ring treatment; both are under review (see the city
  section above).
- The Dock shows only the first cost entry and raw IDs; affordability is only revealed
  after clicking; the preview is a large `arc()` circle with a tiny raft.
- Settings modal is empty; DEV panel is in the normal HUD; no pause, help, or credits.
- No audio, no touch steering, no responsive HUD.
- Continue resets `dayTime` to 0.25; saves have no version; zoom and settings are not saved.
- Inventory pills overflow with all eight item types.
- Click-to-collect divides by `pixelRatio` while comparing against CSS-pixel coordinates,
  so it is offset on high-DPI displays.
- `page-init.js` is a dead jQuery stub; two bundled fonts are unused; there is no README
  or LICENSE.

The full catalogue needs 315 wood, 140 plastic, 65 cloth, 105 scrap, 2 ancient coins, and
2 river gems. Two river gems alone would take roughly 23 hours of spawn events at the
current rate. The ending no longer requires spending gems — it requires *discovering* the
four relics — but the free-play catalogue still does, which is why the relic path needs a
guarantee and the long tail needs its own tuning pass.
