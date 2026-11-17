# Step 5: Soundtrack (NumPy/SciPy, no samples)

```bash
node <skill-dir>/scripts/export.js trailr-output/index.html          # -> timeline.json, sfx.json
python <skill-dir>/scripts/synth.py trailr-output/timeline.json --sfx trailr-output/sfx.json --out trailr-output/soundtrack.wav
```

Use the Python command `doctor.js` printed (`python3`, `python` or `py`). Options: `--key D --mode major|minor`, `--lufs -15`, `--music-gain`, `--sfx-gain`, `--voice voiceover/manifest.json`, `--stems work/stems`, `--no-music` (SFX only, under a licensed track).

## What synth.py makes

- **Grid**: BPM from `timeline.json`, one key (default D major: D–Bm–G–A, one chord per bar), counted from frame 0 so every scene lands on the same grid.
- **Instruments as functions**: kick (pitch-swept sine 140→45 Hz), hats (highpassed noise), clap (3 noise bursts), bass (sine + 2nd harmonic, offbeat 8ths), pad (detuned saws, lowpassed), pluck arps (decaying sines), drone, riser, impact.
- **Arrangement from each scene's `section`** (in `script.json`, carried into the timeline):

  | section | music |
  |---|---|
  | `intro` | soft pad, plucks, a low bass note per bar |
  | `problem` | dark drone, ticking hats, a low pulse |
  | `breath` | silence (the riser, if any, takes only its second half) |
  | `reveal` | impact + lush chord on its first beat, then groove |
  | `groove` | kick, clap on 2 and 4, offbeat hats and bass, arps, pad |
  | `build` | groove with open hats; use before a reveal or the end |
  | `end` | one final chord held to the end, no drums |

  Missing sections default to groove (first scene intro when there are 4+, last scene end). A riser leads into every `reveal` and `end`. The classic story arc: `problem` → `breath` → `reveal` → `groove` … → `end`.
- **SFX per cue type**, tuned to the key so they sit in the music: band-passed noise sweeps for whooshes and swipes, sine blips for pops, thud + noise for stamps, fast clicky ticks for flaps, bright partials for chimes and coins.
- **Mix**: every sound enters through `mix(track, sound, t, gain, pan)`, which trims at both ends (adding at an offset directly overruns the track and numpy raises). Music is sidechain-ducked on kicks, SFX are high-passed out of the bass, light convolution reverb (exp-decay noise IR), narration ducks music ~11 dB with smooth attack/release.
- **Master**: integrated loudness (BS.1770) normalized to -15 LUFS (aim -14 to -16), soft tanh limiter, sample peak ≤ -1 dBFS, exactly `total` seconds long. The report line prints LUFS and peak.

## Adapting it

It is a base, not a black box. For a film that needs something else, copy `synth.py` into `trailr-output/` and edit there: the key and progression, a section recipe in `arrange()`, a new instrument or SFX type. Deliver that copy in the source zip. Keep `mix()` as the only way sounds enter a track.

Styles it can make: electronic/pop grooves, ambient pads, tense drones, cinematic risers and impacts, plucky upbeat. It can't make convincing real instruments (guitar, piano, strings, vocals) or genres that depend on them; for those suggest a licensed track (the user supplies it and its licence). Then use `--no-music` for SFX only and mix the track in FFmpeg, or extend `synth.py` to load it, keeping cuts on its beat grid.

## Narration

When narration is on, follow [voiceover.md](voiceover.md) for takes and approval, then pass `--voice trailr-output/voiceover/manifest.json`:

```json
{ "takes": [ { "scene": "hook", "file": "hook.mp3", "offset": 0.1 } ] }
```

Files resolve relative to the manifest; any format FFmpeg reads. Each take starts at its scene's start + `offset`. Retiming a scene moves its take with it; the file itself doesn't change.

Say in the handoff that licensed music can replace the synthesized track and that the cuts sit on the film's BPM grid.
