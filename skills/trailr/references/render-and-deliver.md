# Steps 6–7: Render, review, deliver

## Before the full render

The user has seen the contact sheet and answered "texts and timing ok?" on the final script table (see [brief-and-script.md](brief-and-script.md)). Any change after this means a re-render.

For a long or 4K film, tell the user the time estimate first: about 0.25 s per frame on 2 cores at 1080p, divided by the workers (a 45 s film at 60 fps is 2,700 frames).

## Render

```bash
node <skill-dir>/scripts/render.js trailr-output/index.html --out trailr-output/film.mp4 --audio trailr-output/soundtrack.wav
```

| Option | Default | Use |
|---|---|---|
| `--format` | horizontal | `vertical`, `square`: also sets the pixel size |
| `--fps` | 60 | 30 for vertical social or long films (half the time) |
| `--workers` | cores − 1 (max 8) | |
| `--from`, `--to` | whole film | re-render a slice to check one moment |
| `--draft` | off | faster encode for a review render |
| `--keep` | off | keep the per-worker chunks in `work/render/` |

Each worker captures a contiguous chunk as JPEG q95 and pipes it into its own FFmpeg (`libx264 -crf 14`); the chunks are joined, the audio muxed, and one final encode makes the delivery file (`-crf 17 -preset slow -movflags +faststart`, which keeps 50 s under ~25 MB; some chat upload limits are 30 MB). At the end render.js counts the frames in the file and warns if they differ from the timeline.

For both formats, render each with its own `--format` from the same page and the same soundtrack.

For stock footage composited under rendered overlays, see [corporate-video.md](corporate-video.md) (transparent PNG frames + FFmpeg overlay) and [stock-video.md](stock-video.md) (footage frames inside the page).

### Gotchas

- Playwright can't find the browser build it expects: `lib/browser.js` already falls back to a Chromium in the `ms-playwright` cache; only if none exists, ask to run `npx playwright install chromium`.
- `page.setContent()` doesn't load local `file://` images: the scripts open the page with `page.goto(file://…)`.
- The shell's working directory can reset between calls: use absolute paths.

## Review the MP4, not just the frames

```bash
ffmpeg -i film.mp4 -vf "fps=1,scale=480:-1,tile=6x10" -frames:v 1 work/review.jpg
```

(For vertical: `scale=216:-1,tile=10x4`.) Read it, plus 2–3 full-resolution frames at the key moments (`ffmpeg -ss 12.5 -i film.mp4 -frames:v 1 work/f12.png`). Check that the audio stream exists and that audio and video durations agree (`ffprobe -show_entries stream=codec_type,duration film.mp4`).

## Deliver

- The MP4.
- A zip of the source: `index.html`, `script.json`, `script.js`, `fonts/`, the film's `synth.py` if adapted, `soundtrack.wav`, voiceover takes + manifest, stock `sources.json`; plus a short `README.txt` with the commands to re-render (`build-script.js` → `export.js` → `synth.py` → `render.js`, pointing to the Trailr scripts). No credentials, no `.env`, no signed URLs.
- For vertical: a cover PNG (the strongest headline frame) for the post thumbnail.
- The final script table, the voice engine and voice used if any, what was redrawn (logo) or substituted (fonts), and where licensed music could replace the synthesized track.
