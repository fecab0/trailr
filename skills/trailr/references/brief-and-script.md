# Steps 2–3: Brief, treatment and script lock

A film costs 20+ minutes of build and render, and the creative direction is the user's call, so don't guess it. Testers' most common hand edits after a render were scene durations, on-screen wording and music feel: lock those before the expensive steps.

## The brief: one round, max 4 questions

Use the host's question tool or one concise chat message. Multiple choice, recommended option first, tailored to what brand research found. Skip any question the request, the conversation or memory already answers (brand notes, a stated format, "no funding mentions"). If the request already specifies direction, state the chosen direction instead of asking. Pick the 3–4 that matter most:

- **Goal and where it will live**: launch announcement / social ad (Reels, TikTok, LinkedIn) / website hero loop / investor or event opener. Drives length, format, pacing and CTA.
- **Format, length and pace**: 16:9 ~45 s / 9:16 ~30 s / both / 15 s teaser; pace slow / normal / fast. Default normal; ask when the goal suggests otherwise (social ads fast, corporate slow). The length is a target, not a contract.
- **Creative direction**: 3 archetypes from [creative-archetypes.md](creative-archetypes.md) that fit this brand, one line each with the reference film named ("Emotional 3-act film (archetype 5)", "Color-per-beat with mascot (archetype 3)", "Warm product walk-through (archetype 1)"). A reference is a concept, not a template: borrow its structure and feel, not its devices (letterbox bars, "Act 1" cards, a specific mascot) unless asked.
- **Tone and voice**: cinematic and emotional / energetic hype / casual founder-talk / near-silent allegory. If narration is requested, confirm language, accent, voice and delivery per [voiceover.md](voiceover.md).
- **Key message and CTA**: the one thing to remember, the claims and numbers allowed, the CTA + URL. Before writing headlines or the closing tagline, show the lines that already work (brand.md) and ask whether the user has favourites, whether those will do, or whether they have others. Only then propose your own, avoiding generic poster lines.
- **Assets**: official logo SVG, screenshots or UI to recreate, artwork (required for painted/allegory styles), music (licensed track vs synthesized).
- **Avoid**: competitors, funding, specific claims, styles they dislike.

Typical lengths: 15–22 s (symbol, hype, founder-talk) · 30 s (allegory) · 30–45 s (vertical social) · 35–52 s (walk-through) · 60 s (emotional film) · 75–90 s (corporate film with voiceover).

## The treatment

Fill [templates/treatment.md](../templates/treatment.md) and send it as one screen: archetype, format and length, pace, the script table, the guide/mascot device, how the logo is played with (see "Logo play" in [engine.md](engine.md)), palette and fonts, what's code vs what needs assets, which numbers come from which source. Wait for a go or edits.

## The script table and `script.json`

The table the user approves *is* `script.json`, next to the page:

```json
{
  "title": "…", "format": "horizontal", "pace": "normal", "target_sec": 45,
  "scenes": [
    { "scene": "hook", "section": "problem", "bars": 2,
      "text": ["Debt collection is *broken*."], "source": ["proposal"],
      "music": "tense drone, ticking" },
    { "scene": "proof", "section": "groove", "bars": 4, "sec": 7, "text": ["…"], "music": "…" }
  ]
}
```

- `scene`: a unique id the page uses (`data-scene`, `at('proof')`).
- `bars` (length at the chosen pace) or `sec` (an override that wins, rounded to whole beats). Lengths, never start times: starts are derived, so changing one scene moves everything after it. See [pacing.md](pacing.md).
- `text`: every on-screen line exactly as it will appear, in order. `*word*` marks the accent word. The page fills elements with `data-text="scene:index"`, so copy never lives in the HTML.
- `source` (per line): `brand` (site or docs copy), `user` (their line) or `proposal` (yours, to approve). The table shows them as [B] [U] [P].
- `section`: the music's role for the stretch: `intro`, `problem`, `breath`, `reveal`, `groove`, `build`, `end` (see [sound.md](sound.md)). `music`: the mood in words, for the user.
- Narrated films add `narration` per scene and a top-level `voiceover` block ([voiceover.md](voiceover.md)).

Run `node <skill-dir>/scripts/build-script.js trailr-output/script.json`. It validates, writes `script.js` (`window.SCRIPT` + `window.TIMING`, loaded with a plain `<script src>` because `fetch()` fails on `file://`), and prints the table with each scene's start and length in seconds, target vs actual total, beat rounding and read-time warnings. Send that table. Ask the user to edit freely; write their changes back into `script.json`, re-run, and send it again until they say go. Later edits are a JSON change plus re-render.

Ask what the music should feel like, but only offer styles the synthesizer can make (see [sound.md](sound.md)); anything else, suggest a licensed track.

Before the full render, with the contact sheet, send the final table once more and ask "texts and timing ok?". Any change after this means a re-render; say so. An explicit request to proceed without approval can cover the script and render gates.

## Copy principles

- Open on a concrete, felt moment (an artifact, a time of night, a pile of overdue notices, an inbox hiding money), a relatable founder truth, or a mythic image, not a claim.
- Personify the pain with specific details from the domain; name what the product replaces.
- Earn the reveal with a contrast shift: dark→brand color, grey→full-bleed gradient, night→day, letterbox→full frame, noise→silence.
- One idea per beat, 3–7 words on screen at a time; headlines build word by word; accent the single word that carries the meaning.
- Show proof inside real-looking UI (their dashboard patterns), numbers counting up, data arriving (split-flap, tickers), the product flow step by step. For an allegory, let one metaphor carry the film and save the words for one closing line.
- Voice options: second-person cinematic ("You made something…"), question→answer, a casual run-on sentence across beats (founder-talk), or near-silent allegory with one final line. Time-skip lines ("A few weeks later…") move the story without narration.
- End on mission or transformation + wordmark + one CTA + URL. The strongest closes: a tagline that plays on the brand name, a short risk-reversal ("No win. No fee."), or a one-line definition of the category. A last frame that loops to the first works on social.
- Demo data (names, IDs) must read as illustrative.
