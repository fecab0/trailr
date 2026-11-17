# Step 4: The engine (one HTML page)

Start from `<skill-dir>/templates/index.html`: copy it into `trailr-output/`, keep its contract and helpers, replace the demo scenes with the approved script's scenes, delete what the film doesn't use. Fonts: copy the `@fontsource/*` files into `trailr-output/fonts/` and declare them with `@font-face` (Google Fonts is usually unreachable from the shell).

## The contract (the scripts depend on it)

- `window.render(t)`: sets every element from `t` alone. Same `t`, same frame.
- `window.TIMELINE` = `{bpm, total, scenes:[{id, start, dur, section}]}`, from `TIMING`.
- `window.SFX` = `[{t, type, gain, pan}]`, built once at load (`cue(t, type, gain, pan)`), never inside `render`. Types synth.py knows: `pop`, `tap`, `click`, `type`, `whoosh`, `swipe`, `stamp`, `flap`, `impact`, `chime`, `coin`, `ding`.
- `?format=horizontal|vertical|square` picks `W,H`; render.js and stills.js pass it.
- Optional `window.__ready` (a promise: fonts, images) and `window.__frameReady(t)` (e.g. wait for a footage frame's `img.decode()`).

## What the template already has

- **Layers** with explicit z-order: world (camera canvas) < overlays (end card, cold open) < grain < vignette.
- **Easing** `E.out` (cubic), `io`, `expo`, `xio` (expo in-out, for whips), `back` (overshoot pops), `in`; `P(t,a,b,e)` = eased progress; `clamp`, `lerp`, seeded `rng(seed)`.
- **Copy from the script**: `data-text="scene:index"` fills the element from `script.json`; `*word*` becomes `<em>` (the accent).
- **Declarative reveals**: `data-scene="proof" data-in="2"` (beats from the scene start) + `data-fx="rise|word|pop|right|fade|stamp"`, optional `data-dur` (beats), `data-out` (beat to fade out), `data-base` (resting transform, e.g. `rotate(-2deg)`), `data-sfx` (a cue on entry).
- **Split headlines**: `.split[data-in][data-st]` wraps words into inline-blocks with staggered times; an `<em>` accent stays one unit; punctuation stays attached. Word fx = rise .45em + blur 12 px → 0, expo.
- **Typing**: `.type[data-scene][data-t0][data-t1]` slices the text + blinking caret, with `type` SFX.
- **Counters**: `.count[data-from][data-to][data-t0][data-t1][data-locale][data-dec][data-prefix][data-suffix]`, expo ease, in the brand's locale (€1.324.965, 67,8 %).
- **Camera over a world canvas** with keyframes `[t, cx, cy, scale, ease]`, scale interpolated in log space, whip on the cut, directional motion blur from screen-space velocity (SVG `feGaussianBlur stdDeviation="bx by"`, `filter:none` when still).
- **Guide**: hops between world-space points (parabolic hop, bob, `tap` on landing), swallowed by the iris into the end card.
- **End card** as its own full-screen overlay, opened by an iris from the guide.
- **Grain** drawn once into a canvas and jittered per frame.

## Building blocks to add as the film needs

- **Camera layout**: horizontal: a 3×2 grid at ~2200 px spacing; vertical: a column or 2 columns × 3 rows at ~1200 × 2100, so most moves are tilts. Panels are seen one at a time; never frame the whole grid. Whip pans with `xio` ~0.7 s.
- **Accent words**: (a) highlighter: `em.hl` with a brand `linear-gradient` whose `background-size` animates 0→100% × .38em, `white-space:nowrap`; (b) a solid box behind the keyword (Color-per-beat); (c) the keyword recolored in the accent (Night-to-day gold); (d) serif-italic word in the accent with a hand-drawn scribble underline drawn via `stroke-dashoffset`, plus tiny doodle sparks (Founder-talk).
- **Word-swap list**: one slot cycles items on the beat ("Instagram, TikTok, X, Threads, Reddit.") while a matching card joins a growing grid each time.
- **Multiplying grid**: one card becomes 2 → 4 → hundreds → thousands as the grid subdivides and the camera pulls back, with a mono counter ("2 VARIANTS" → "10,000 VARIANTS"). CSS grid with deterministic content; past ~400 cells switch to a pre-drawn canvas texture.
- **Split-flap board** (Night-to-day reveal): character tiles cycle seeded random glyphs every ~2 frames (seed = tile index + frame) until a staggered settle time, left→right/top→bottom; outline highlighted rows (DELAYED/CANCELLED), then flip the board to a message. Great for any data that "arrives".
- **Guide character**: a brand element (logo tile, mascot, orb, little robot, the app icon with a face) that hops between focal points (tap-pulse + ring on key moments) and finally becomes the logo. This one device gives the film continuity. Keep it off headlines.
- **Endings** (never an overview grid): the guide flies off the last scene and lands as the logo on the end card; an iris or color-block cut from the last beat; a push-in through the last UI element (a button, a notification) into the end card; or a match cut whose last frame loops to the first.
- **Transitions**: iris (`clip-path: circle(r at x y)` from a brand shape or the guide); torn-paper wipe (a jagged polygon panel sliding over); color-block cut on the beat (neutral → full-bleed brand gradient for the turn); sky-to-day (night gradient → daylight clouds); ink/paint reveal (an irregular mask growing from a point).
- **Logo play**: find a way to play with the logo based on what it represents and propose it in the treatment: a symbol of three joined people draws itself stroke by stroke; the logo's shape becomes the iris or mask; it shows up inside the product UI or returns at the close. Self-drawing logo: the official SVG revealed through a mask of strokes along its centerline, `pathLength="1"`, animated `stroke-dashoffset`, `stroke-dasharray="1 2"` (not `"1 1"`, which leaves a dot at the end).
- **Familiar app UIs** (WhatsApp, Gmail, an AI assistant…): recreate them in code so they're recognized instantly, without rights issues: no real screenshots, other brands' logos out of the spotlight, nothing suggesting endorsement. Copy real gestures: a date label, bubbles with timestamp and double check, "typing…", messages typed then deleted, light/dark theme to match the moment, a pill marking time passing ("1 month ago").
- **Stamps**: circular or rounded-rect rubber stamps that slam in (`data-fx="stamp"`: scale 2.4→1, ease-in, slight rotation via `data-base`, a card shake): "Handled.", "SENT VIA CERTIFIED EMAIL", "UNCLAIMED", "On autopilot".
- **Sunburst / shower**: rotating `repeating-conic-gradient` rays behind a big number or mascot; or a particle shower (coins, confetti) with seeded physics for the payoff.
- **Artwork scenes** (user-supplied illustrations): Ken Burns push-ins, 2.5D parallax from art split into 2–4 layers moving at different rates, drifting clouds, match cuts (zoom into an eye or reflection and out into the next scene), paper/grain on top, product UI composited *into* the painted world.

## Performance

~0.25 s/frame on 2 cores at 1080p. Avoid `feTurbulence` (SVG noise or displacement): it made frames 4× slower; draw grain once into a canvas and pre-jitter hand-drawn paths instead. Motion-blur filters on the whole world are fine only during moves.

## Before showing anything

Run `node <skill-dir>/scripts/stills.js trailr-output/index.html` (add `--format vertical` for vertical) and read `work/stills/contact.jpg`. `--auto` takes a settled frame per scene and both sides of every cut, so transitions (iris, whips, handoffs) are checked, not just holds. Check that the guide never overlaps a headline, that nothing overflows, and contrast. Use `--full 3.2,9.8` for full-size frames of anything doubtful. Fix and repeat, then share the contact sheet with the user.
