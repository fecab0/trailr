# Pacing and scene durations

How long each scene stays on screen is the first thing users retouch, so it is a setting, not something baked into dozens of timestamps.

## The model

- **The story sets the length.** The brief's duration is a guide. If the script needs more or less time, adjust and show target vs actual total in the table. Never cut or pad scenes just to hit the number.
- **Pace** changes the BPM, not a stretch factor, so cuts stay on the beat and the music changes tempo with the picture: `slow` = 100 BPM (1 bar = 2.4 s), `normal` = 120 (2 s), `fast` = 140 (~1.71 s). A 44 s film at normal is ~53 s slow, ~38 s fast; say so when checking the length against the brief.
- **The scene table** in `script.json` is the single source of truth. `build-script.js` computes every start from the lengths (`bars`, or a `sec` override rounded to whole beats) into `window.TIMING`; the page never recomputes it.

## In the page

```js
// from templates/index.html
const BPM = TIMING.bpm, BEAT = 60 / BPM, BAR = 4 * BEAT;
const S = Object.fromEntries(TIMING.scenes.map(s => [s.id, s]));
const at = (id, beat = 0) => { if (!S[id]) throw new Error(`Unknown scene: ${id}`); return S[id].start + beat * BEAT; };
window.TIMELINE = { bpm: BPM, total: TIMING.total, scenes: … };
```

Everything reads from it: reveals (`data-scene` + `data-in` in beats), camera and guide keyframes (`[at('proof'), cx, cy, s, e]`), typing and counters (`data-t0`/`data-t1` in beats), SFX cues (`cue(at('reveal'), 'impact')`), the music arrangement and the render length (`TIMELINE.total`). A grep for literal seconds outside the table should find almost nothing; the exceptions are short fixed durations of a single move (a 0.6 s rise, a 0.35 s whip).

## Rules

- Animations inside a scene are written in beats, so they speed up and slow down with the pace.
- When a `sec` override is longer than the content, hold the final state; don't stretch the animation. When it is shorter than the content needs (< ~1.5 s for a 3–7 word headline), say so instead of cutting the text off.
- Minimum read time: ~0.3 s per word + 0.5 s, never under 1.5 s for a headline, at any pace. `build-script.js` warns when a line can't be read in its scene. If `fast` breaks this for one beat, give that scene a `sec` override rather than slowing the whole film.
- In the table shown to the user, give each scene's start and length in seconds so they can answer "longer here, shorter there". Disclose beat-grid rounding. Write their answer back as a `sec` override (or a new `pace`) in `script.json` and re-run `build-script.js`; never edit timestamps elsewhere. Repeat the table in the handoff.
