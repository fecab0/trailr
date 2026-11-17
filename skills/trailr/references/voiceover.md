# Spoken narration

Read this reference when the user requests narration, a spoken demo, or a supplied voice track. Narration is optional and works for any video format, not only corporate films. Keep it off when the brief does not call for speech.

## Choose a source

| Source | Credentials | Use it when |
| --- | --- | --- |
| User-supplied audio | None | The user already has a recording or wants to record the approved script. |
| Existing local speech engine, such as Kokoro | No speech API key | A working local installation and a suitable voice/language are available. Model downloads and local dependencies may still be needed. |
| Official ElevenLabs MCP | OAuth managed by ElevenLabs | The user chooses ElevenLabs and connects an account with suitable voice access and credits. |
| Other connected speech tool | Managed by the connector | The user selects another service that supports the requested voice, language, output and budget. |

Honor a requested provider. Otherwise explain the available suitable options briefly and select with the user as part of the brief. A local engine is an option, not a bundled Trailr dependency. Do not install another video framework just to obtain speech. Do not silently switch providers after an error.

Read [External tools and credentials](external-tools.md) before using a connected or remote service. Do not copy code from another skill to add a speech engine; use its supported interface or write an independent integration.

## Kokoro voice selection and disclosure

Avoid Michael as Trailr's default Kokoro voice: it is widely used and too recognizable. This is a Trailr creative preference, not an assumption that every Kokoro installation or wrapper defaults to Michael.

- Before generating any Kokoro audio, inspect the installed engine or wrapper's voice list and resolve the actual voice name and ID. Do not rely on its implicit default or guess a voice ID.
- Choose a suitable non-Michael voice for the requested language, accent and delivery, and pass its ID explicitly on every generation call. For a new voice choice, audition a short approved line before generating the full film. Do not replace Michael with another permanently fixed default.
- Tell the user before generation: "I am using Kokoro with [voice name / ID]. I have selected an alternative to Michael." Include the provider and actual voice in the final handoff too. Notify the user whenever Kokoro is used, including through a connected tool or another framework.
- Use Michael only when the user explicitly requests or approves that voice after the choice is disclosed. State that it is Michael before generation; do not silently fall back to it when an alternative fails.
- If a wrapper does not expose voice selection, or the actual voice cannot be verified, explain that limitation before generating. Use a tool that exposes voice selection or obtain approval for the disclosed limitation.
- Record the choice in `script.json`: for example, `voiceover.provider` as `local`, `voiceover.engine` as `kokoro`, and the resolved `voiceover.voice_id` and `voiceover.voice_name`. Preserve those values in the delivery notes.

## Approve the script and voice

Confirm the spoken language, accent, delivery, target length and any brand-name pronunciations already missing from the brief. Trailr's documentation is English; the video language follows the user's brief.

Add exact narration to the same scene table as on-screen copy. Speech should explain or connect the visuals rather than mechanically read every headline. Keep spoken wording in `script.json`, using an optional `narration` string per scene. An omitted or empty string means no speech in that scene.

For ElevenLabs MCP generation, extend the existing script as follows:

```json
{
  "pace": "normal",
  "voiceover": {
    "enabled": true,
    "provider": "elevenlabs",
    "transport": "mcp",
    "voice_id": "REPLACE_WITH_AN_AVAILABLE_VOICE_ID",
    "model_id": "REPLACE_WITH_A_SUPPORTED_MODEL_ID"
  },
  "scenes": [
    {
      "scene": "hook",
      "text": ["Make room for your best work."],
      "bars": 2,
      "music": "Restrained opening pulse",
      "narration": "Your next great idea deserves more time."
    }
  ]
}
```

Keep credentials out of this file. Preserve the existing scene IDs and timing fields. User-supplied or locally generated audio can use the same `narration` fields, with `voiceover.provider` set to `supplied` or `local`. The agent interprets this configuration; it is not a literal MCP request schema.

For a voice audition, use a temporary script containing only one short approved scene. Auditions on a paid service also consume credits. Confirm the voice using the sample before generating all scenes; skip this gate if the user has already selected a voice and authorized full generation. Do not clone a voice as part of ordinary narration setup.

## Connect the official ElevenLabs MCP

Use the official remote server:

```text
https://api.elevenlabs.io/v1/mcp
```

The user adds this URL through their client's MCP or custom connector settings, signs in with ElevenLabs using OAuth, selects a workspace and grants the required speech permissions. Do not request an API key or create a direct API fallback. Installing Trailr does not connect or authenticate this server automatically.

Before generation, discover the tools actually exposed by the connection and inspect their input schemas. Resolve the available voices and supported speech models through those tools; do not hard-code tool names or assume the connector exposes every ElevenLabs feature. If the MCP is unavailable or lacks speech/file access, explain what connection or permission is missing, keep independent preparation moving, and wait on generation until access is restored or the user chooses another source.

## Generate, download and reuse

1. Prepare the exact per-scene narration, selected voice/model and expected input size from the approved script. This preparation is local and does not require a generation call. Check the current account pricing or agreed credit limit; character count alone is not a price quote.
2. Once provider, wording, voice and paid usage are authorized, call the MCP's speech generation tool. Prefer one take per scene when supported. Save any returned generation or Flow IDs immediately so interrupted calls can be looked up instead of repeated.
3. Retrieve and download the actual audio through the MCP's supported file/result tools or the provider-returned download link. Generated media links can expire; save a local copy promptly. If a result is still pending, poll its existing job rather than starting a replacement.
4. Store the takes under `<output-dir>/voiceover/` and maintain a local `manifest.json` mapping scene IDs to files, measured durations, provider, voice/model IDs and generation IDs. Record the narration or its hash so reuse is based on the exact text, voice and model. Do not include OAuth tokens or signed download URLs in the source delivery.
5. Reuse unchanged takes when timing changes. Regenerate only changed wording, voice or model. On timeouts or uncertain outcomes, inspect the existing generation or provider history first; never automatically resubmit a potentially billable request.

Measure each downloaded file with `ffprobe` and listen to it before mixing. If the connector cannot return a downloadable audio asset, explain that limitation rather than treating a preview or Flow link as the finished local voice track.

## Synchronize with the approved timeline

- Generate or inspect speech before committing to a full visual render. Measure each file using `ffprobe`; never assume spoken duration from word count alone.
- Position each take at its scene start from `timeline.json`, with a small breathing lead if appropriate. Keep the manifest's source duration separate from the timeline's scene duration.
- If a take exceeds the available scene length, shorten the wording or propose a longer `sec` override. Get approval for changed copy or timing, re-run `build-script.js` (regenerates `script.js`) and `export.js` (a fresh `timeline.json`). Account for the beat rounding described in [Pacing and scene durations](pacing.md). Do not crop words or speed up speech merely to force a fit.
- Retiming a scene shifts later scenes, narration starts, SFX and the music arrangement together. The speech file itself does not need to change when only its start moves.
- For supplied audio covering several scenes, mark sentence boundaries and derive scene timing from the recording. Do not split in the middle of a word.

## Mix, review and deliver

Keep voice, music and SFX as separate stems. `synth.py --voice voiceover/manifest.json` decodes each take through FFmpeg to the mix rate and layout, places it at its scene start + `offset`, and ducks the music (see [sound.md](sound.md)); `--stems` writes the stems. The manifest's `takes` entries need `scene` and `file`; the other fields described above (durations, provider, IDs, text hash) can sit alongside. Render narration into the final audio mix: browser audio playback is not captured by screenshot rendering.

Duck music during spoken phrases, with a short attack and a smooth release (about 300-400 ms is a starting point). Start around 10-12 dB lower music during speech, then listen and adjust for intelligibility. These are starting settings, not a substitute for listening. Avoid loud SFX over key words and check the final mix for clipping and audible scene boundaries.

Review a short video with sound before the full export. Listen for names, pronunciation, unnatural pauses, dropped words and narration crossing the next scene. Check the final MP4 has an audio stream and that its audio and video durations agree. Include approved narration, source takes, the manifest, final timing and mixing instructions in the source delivery; exclude credentials and local environment files. Add subtitles only if requested, using the approved text and measured word timing when available.

## Provider documentation

- [Official ElevenLabs MCP documentation](https://elevenlabs.io/docs/eleven-api/resources/mcp-server)
- [ElevenLabs MCP connection guide](https://elevenlabs.io/mcp)
