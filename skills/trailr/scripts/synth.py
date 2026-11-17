#!/usr/bin/env python3
"""Trailr soundtrack: music + SFX + optional narration, synthesized with NumPy/SciPy (no samples).

    python synth.py timeline.json --sfx sfx.json --out soundtrack.wav
        [--voice voiceover/manifest.json] [--key D] [--mode major] [--lufs -15] [--stems dir] [--no-music]

Inputs come from the page (export.js): timeline.json gives BPM and scenes, each with an optional
`section` (intro | problem | breath | reveal | groove | build | end) that picks the arrangement;
sfx.json gives the cues [{t, type, gain?, pan?}].

This is a base, not a black box: copy it into the film's output folder and adapt it there
(the key and progression, a section recipe, a new instrument, a new SFX type). Keep `mix()`:
it is the only way sounds enter a track, so nothing overruns the end or mismatches lengths.
"""
import argparse
import json
import math
import os
import subprocess
import sys

import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 48000
RNG = np.random.default_rng(7)  # fixed seed: the same timeline always gives the same audio
NOTE = {"C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4, "F": 5, "F#": 6, "Gb": 6,
        "G": 7, "G#": 8, "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11}
# Scale degrees (0-based) of a 4-chord loop, one chord per bar.
PROGRESSIONS = {"major": [0, 5, 3, 4],   # I – vi – IV – V   (D: D – Bm – G – A)
                "minor": [0, 5, 2, 6]}   # i – VI – III – VII
SCALES = {"major": [0, 2, 4, 5, 7, 9, 11], "minor": [0, 2, 3, 5, 7, 8, 10]}


# ---------------------------------------------------------------- basics
def n(sec):
    return max(1, int(round(sec * SR)))


def tvec(sec):
    return np.arange(n(sec)) / SR


def hz(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


def sos(kind, freq, order=2):
    return signal.butter(order, freq, btype=kind, fs=SR, output="sos")


def filt(x, kind, freq, order=2):
    return signal.sosfilt(sos(kind, freq, order), x)


def noise(sec):
    return RNG.standard_normal(n(sec))


def env(sec, a=0.005, d=None, rel=0.05):
    """Attack, then exponential decay (d = time constant) or sustain, then release."""
    t = tvec(sec)
    e = np.ones_like(t)
    if a > 0:
        e *= np.clip(t / a, 0, 1)
    if d:
        e *= np.exp(-np.maximum(t - a, 0) / d)
    if rel > 0:
        e *= np.clip((sec - t) / rel, 0, 1)
    return e


def mix(track, sound, t, gain=1.0, pan=0.0):
    """Add a mono or stereo sound into a stereo track at time t (s). Trims at both ends."""
    start = int(round(t * SR))
    if gain == 0 or start >= len(track):
        return
    if start < 0:
        sound = sound[-start:]
        start = 0
    end = min(len(track), start + len(sound))
    if end <= start:
        return
    seg = sound[: end - start]
    if seg.ndim == 1:
        ang = (np.clip(pan, -1, 1) + 1) * math.pi / 4
        track[start:end, 0] += seg * gain * math.cos(ang) * math.sqrt(2)
        track[start:end, 1] += seg * gain * math.sin(ang) * math.sqrt(2)
    else:
        track[start:end] += seg * gain


# ---------------------------------------------------------------- instruments (mono)
def kick():
    t = tvec(0.45)
    f = 45 + (140 - 45) * np.exp(-t * 25)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7)
    click = filt(noise(0.45), "highpass", 2500) * np.exp(-t * 300) * 0.3
    return (body + click) * 0.9


def hat(open_=False):
    sec = 0.25 if open_ else 0.06
    return filt(noise(sec), "highpass", 7000) * np.exp(-tvec(sec) * (14 if open_ else 70)) * 0.35


def clap():
    out = np.zeros(n(0.3))
    for k, off in enumerate((0.0, 0.011, 0.023)):
        b = filt(noise(0.3), "bandpass", [900, 2600]) * np.exp(-tvec(0.3) * (90 if k < 2 else 18))
        mix_mono(out, b, off)
    return out * 0.5


def mix_mono(track, sound, t, gain=1.0):
    s = int(round(t * SR))
    e = min(len(track), s + len(sound))
    if e > s:
        track[s:e] += sound[: e - s] * gain


def bass(f, sec):
    t = tvec(sec)
    x = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(4 * np.pi * f * t)
    return x * env(sec, 0.004, sec * 0.6, 0.03) * 0.55


def pad(freqs, sec, bright=1800, level=0.18):
    t = tvec(sec)
    x = np.zeros_like(t)
    for f in freqs:
        for cents in (-9, 0, 8):
            x += signal.sawtooth(2 * np.pi * f * 2 ** (cents / 1200) * t + RNG.uniform(0, 6.28))
    x = filt(x / (3 * len(freqs)), "lowpass", bright)
    return x * env(sec, min(0.4, sec / 3), None, min(0.6, sec / 3)) * level


def pluck(f, sec=0.4):
    t = tvec(sec)
    x = sum(np.sin(2 * np.pi * f * h * t) * (0.6 / h) * np.exp(-t * (8 + 6 * h)) for h in (1, 2, 3, 4))
    return x * env(sec, 0.002, None, 0.03) * 0.5


def drone(freqs, sec):
    t = tvec(sec)
    lfo = 0.75 + 0.25 * np.sin(2 * np.pi * 0.25 * t)
    return pad(freqs, sec, bright=700, level=0.16) * lfo


def sweep(sec, lo, hi, bands=6, rising=True):
    """Noise that moves through frequency: band-passed noises crossfaded over time."""
    out = np.zeros(n(sec))
    t = tvec(sec) / sec
    centers = np.geomspace(lo, hi, bands)
    if not rising:
        centers = centers[::-1]
    for i, c in enumerate(centers):
        w = np.exp(-((t - i / max(1, bands - 1)) ** 2) / 0.02)
        lo_c, hi_c = c / 1.5, min(c * 1.5, SR / 2 - 100)
        out += filt(noise(sec), "bandpass", [lo_c, hi_c]) * w
    return out / bands * 2.2


def riser(sec):
    t = tvec(sec)
    x = sweep(sec, 300, 9000, bands=8) * (t / sec) ** 2
    f = 220 * 2 ** (2 * t / sec)
    x += np.sin(2 * np.pi * np.cumsum(f) / SR) * (t / sec) ** 3 * 0.12
    return x * 0.5


def impact():
    t = tvec(1.6)
    f = 70 * np.exp(-t * 1.5) + 35
    boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2.5)
    hit = filt(noise(1.6), "lowpass", 3000) * np.exp(-t * 12) * 0.5
    return (boom + hit) * 0.9


# ---------------------------------------------------------------- SFX (mono), tuned to the key
def sfx_sound(kind, root):
    k = kind.lower()
    if k == "pop":
        t = tvec(0.09)
        f = hz(root + 24 + 7) * (1 + 0.5 * np.exp(-t * 60))
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 45) * 0.5
    if k in ("tap", "click"):
        t = tvec(0.05)
        return (filt(noise(0.05), "bandpass", [1500, 6000]) * np.exp(-t * 180) * 0.6
                + np.sin(2 * np.pi * 180 * t) * np.exp(-t * 90) * 0.3)
    if k == "type":
        t = tvec(0.03)
        return filt(noise(0.03), "bandpass", [2000, 8000]) * np.exp(-t * 300) * 0.35
    if k == "whoosh":
        return sweep(0.45, 250, 5000) * np.sin(np.pi * tvec(0.45) / 0.45) * 0.6
    if k == "swipe":
        return sweep(0.25, 600, 7000) * np.sin(np.pi * tvec(0.25) / 0.25) * 0.5
    if k == "stamp":
        t = tvec(0.35)
        return (np.sin(2 * np.pi * 85 * t) * np.exp(-t * 18) * 0.8
                + filt(noise(0.35), "lowpass", 2500) * np.exp(-t * 40) * 0.6)
    if k == "flap":
        out = np.zeros(n(0.3))
        for i in range(10):
            mix_mono(out, filt(noise(0.012), "bandpass", [1800, 6000]) * 0.4, i * 0.028)
        return out
    if k == "impact":
        return impact() * 0.7
    if k in ("chime", "coin", "ding"):
        t = tvec(1.2)
        base = hz(root + 36 + (7 if k == "coin" else 0))
        x = sum(np.sin(2 * np.pi * base * r * t) * a * np.exp(-t * d)
                for r, a, d in ((1, 0.6, 3), (2.76, 0.25, 6), (5.4, 0.12, 10)))
        return x * 0.4
    print(f"[synth] unknown SFX type '{kind}', using pop", file=sys.stderr)
    return sfx_sound("pop", root)


# ---------------------------------------------------------------- arrangement
def default_section(i, count):
    if i == count - 1:
        return "end"
    if i == 0 and count > 3:
        return "intro"
    return "groove"


def chord_notes(root, mode, degree, octave=0):
    scale = SCALES[mode]
    return [root + 12 * octave + scale[(degree + k) % 7] + 12 * ((degree + k) // 7) for k in (0, 2, 4)]


def arrange(tl, root, mode):
    """Music and drum buses following the scene sections. Edit the recipes here per film."""
    bpm = tl["bpm"]
    beat = 60.0 / bpm
    bar = 4 * beat
    total = tl["total"]
    length = n(total + 3.0)  # tail for reverb, trimmed later
    music = np.zeros((length, 2))
    drums = np.zeros((length, 2))
    kicks = []
    scenes = tl["scenes"]
    secs = [s.get("section") or default_section(i, len(scenes)) for i, s in enumerate(scenes)]
    prog = PROGRESSIONS[mode]

    def section_at(t):
        for s, sec in zip(scenes, secs):
            if s["start"] <= t + 1e-6 < s["start"] + s["dur"]:
                return sec, s
        return secs[-1], scenes[-1]

    def chord_at(t):  # counted from frame 0, so every scene lands on the same grid
        return prog[int(t // bar) % len(prog)]

    n_beats = int(math.ceil(total / beat - 1e-6))
    for b in range(n_beats):
        t = b * beat
        sec, sc = section_at(t)
        deg = chord_at(t)
        notes = chord_notes(root + 48, mode, deg)  # around C3–B3
        in_bar = b % 4
        first_beat_of_scene = abs(t - sc["start"]) < 1e-6
        if sec == "breath":
            continue
        if sec == "end":
            if first_beat_of_scene:
                hold = max(beat, total - t)
                mix(music, pad([hz(m) for m in notes + [notes[0] + 12]], hold + 1.5, bright=2600, level=0.24), t)
                mix(music, bass(hz(notes[0] - 12), min(hold, 2.5)), t, 0.8)
                for k, m in enumerate(notes + [notes[0] + 12]):
                    mix(music, pluck(hz(m + 12), 1.2), t + k * beat / 4, 0.5, pan=-0.3 + 0.2 * k)
            continue
        if in_bar == 0 or first_beat_of_scene:
            rest = min(bar - in_bar * beat, sc["start"] + sc["dur"] - t)
            if sec == "problem":
                mix(music, drone([hz(notes[0] - 12), hz(notes[0] - 5)], rest + 0.3), t)
            elif sec == "intro":
                mix(music, pad([hz(m) for m in notes], rest + 0.4, bright=1600, level=0.3), t)
            else:
                mix(music, pad([hz(m) for m in notes], rest + 0.4), t, 0.9)
        if sec == "problem":
            for h in range(2):
                mix(drums, hat(), t + h * beat / 2, 0.35 if h else 0.5, pan=0.2)
            if in_bar == 0:
                mix(music, bass(hz(notes[0] - 12), beat * 1.5), t, 0.8)
            continue
        if sec == "intro":
            if in_bar in (0, 2):
                mix(music, pluck(hz(notes[in_bar // 2] + 12), 0.9), t, 0.6, pan=-0.2 if in_bar else 0.2)
            if in_bar == 0:
                mix(music, bass(hz(notes[0] - 12), bar * 0.9), t, 0.5)
            continue
        # groove / build / reveal
        if sec == "reveal" and first_beat_of_scene:
            mix(drums, impact(), t, 0.9)
            mix(music, pad([hz(m) for m in notes + [notes[0] + 12, notes[1] + 12]], bar * 1.5, bright=3200, level=0.26), t)
        mix(drums, kick(), t, 0.9)
        kicks.append(t)
        if in_bar in (1, 3):
            mix(drums, clap(), t, 0.55, pan=-0.05)
        mix(drums, hat(open_=(sec == "build" and in_bar == 3)), t + beat / 2, 0.45, pan=0.25)
        mix(music, bass(hz(notes[0] - 12), beat * 0.45), t + beat / 2, 0.85)
        arp = [notes[0], notes[1], notes[2], notes[1]]
        mix(music, pluck(hz(arp[in_bar] + 12), 0.35), t, 0.35, pan=-0.35)
        mix(music, pluck(hz(arp[(in_bar + 2) % 4] + 12), 0.35), t + beat / 2, 0.25, pan=0.35)

    # Risers into the turn and into the end card; a breath before them stays silent in its first half.
    for i in range(1, len(scenes)):
        if secs[i] not in ("reveal", "end"):
            continue
        prev = scenes[i - 1]
        avail = prev["dur"] * (0.5 if secs[i - 1] == "breath" else 1.0)
        length_r = min(bar, avail)
        if length_r >= beat * 0.75:
            mix(music, riser(length_r), scenes[i]["start"] - length_r, 0.7)

    return music, drums, kicks


def sidechain(length, kicks, depth=0.45, tau=0.12):
    g = np.ones(length)
    span = n(tau * 5)
    curve = 1 - depth * np.exp(-np.arange(span) / (tau * SR))
    for t in kicks:
        s = int(round(t * SR))
        e = min(length, s + span)
        if e > s:
            g[s:e] = np.minimum(g[s:e], curve[: e - s])
    return g[:, None]


def reverb(x, sec=1.6, wet=0.18):
    ir = noise(sec) * np.exp(-tvec(sec) * (6.9 / sec))
    ir = filt(ir, "lowpass", 6000)
    ir /= np.sqrt(np.sum(ir ** 2))
    out = x.copy()
    for c in range(2):
        out[:, c] += signal.fftconvolve(x[:, c], ir)[: len(x)] * wet
    return out


# ---------------------------------------------------------------- narration
def decode(path):
    """Any audio file -> float stereo at SR, through ffmpeg."""
    p = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-f", "f32le", "-ac", "2", "-ar", str(SR), "-"],
                       capture_output=True, check=True)
    return np.frombuffer(p.stdout, dtype=np.float32).reshape(-1, 2).astype(np.float64)


def load_voice(manifest_path, tl, length):
    with open(manifest_path, encoding="utf-8") as f:
        man = json.load(f)
    takes = man.get("takes", man) if isinstance(man, dict) else man
    if isinstance(takes, dict):
        takes = [{"scene": k, "file": v} for k, v in takes.items()]
    starts = {s["id"]: s["start"] for s in tl["scenes"]}
    base = os.path.dirname(os.path.abspath(manifest_path))
    voice = np.zeros((length, 2))
    spans = []
    for tk in takes:
        sid = tk["scene"]
        if sid not in starts:
            raise SystemExit(f"[synth] voice take for unknown scene '{sid}'")
        f = tk["file"] if os.path.isabs(tk["file"]) else os.path.join(base, tk["file"])
        audio = decode(f)
        t = starts[sid] + float(tk.get("offset", 0.1))
        mix(voice, audio, t, float(tk.get("gain", 1.0)))
        spans.append((t, t + len(audio) / SR))
    return voice, spans


def duck_curve(length, spans, db=-11, attack=0.08, release=0.35):
    g = np.ones(length)
    low = 10 ** (db / 20)
    for a, b in spans:
        s, e = n(max(0, a - attack)), min(length, n(b))
        g[s:e] = np.minimum(g[s:e], low)
    # smooth with a one-pole in both directions (attack/release-ish)
    k = 1 - math.exp(-1 / (release * SR / 3))
    g = signal.lfilter([k], [1, k - 1], g)
    g = signal.lfilter([k], [1, k - 1], g[::-1])[::-1]
    return np.clip(g, low, 1)[:, None]


# ---------------------------------------------------------------- loudness (ITU-R BS.1770, 48 kHz)
def lufs(x):
    b1, a1 = [1.53512485958697, -2.69169618940638, 1.19839281085285], [1.0, -1.69065929318241, 0.73248077421585]
    b2, a2 = [1.0, -2.0, 1.0], [1.0, -1.99004745483398, 0.99007225036621]
    y = signal.lfilter(b2, a2, signal.lfilter(b1, a1, x, axis=0), axis=0)
    blk, hop = n(0.4), n(0.1)
    if len(y) < blk:
        return -70.0
    pw = np.array([np.sum(np.mean(y[i:i + blk] ** 2, axis=0)) for i in range(0, len(y) - blk + 1, hop)])
    pw = pw[pw > 10 ** ((-70 + 0.691) / 10)]
    if not len(pw):
        return -70.0
    rel = 10 * math.log10(np.mean(pw)) - 0.691 - 10
    pw = pw[10 * np.log10(pw) - 0.691 > rel]
    return 10 * math.log10(np.mean(pw)) - 0.691


def master(x, target=-15.0, ceiling_db=-1.0):
    ceiling = 10 ** (ceiling_db / 20)
    for _ in range(3):
        cur = lufs(x)
        if cur <= -69:
            break
        x = x * 10 ** ((target - cur) / 20)
        x = ceiling * np.tanh(x / ceiling)  # soft limiter
    return np.clip(x, -ceiling, ceiling)


# ---------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("timeline")
    ap.add_argument("--sfx")
    ap.add_argument("--voice", help="voiceover manifest.json: {takes:[{scene, file, offset?, gain?}]}")
    ap.add_argument("--out", default="soundtrack.wav")
    ap.add_argument("--key", default="D")
    ap.add_argument("--mode", default="major", choices=sorted(SCALES))
    ap.add_argument("--lufs", type=float, default=-15.0)
    ap.add_argument("--music-gain", type=float, default=1.0)
    ap.add_argument("--sfx-gain", type=float, default=0.8)
    ap.add_argument("--no-music", action="store_true")
    ap.add_argument("--stems", help="also write music/drums/sfx/voice stems to this folder")
    a = ap.parse_args()

    with open(a.timeline, encoding="utf-8") as f:
        tl = json.load(f)
    if a.key not in NOTE:
        raise SystemExit(f"Unknown key {a.key}")
    root = NOTE[a.key]
    total = tl["total"]
    length = n(total + 3.0)

    if a.no_music:
        music, drums, kicks = np.zeros((length, 2)), np.zeros((length, 2)), []
    else:
        music, drums, kicks = arrange(tl, root, a.mode)
    music = music * sidechain(length, kicks)

    sfx = np.zeros((length, 2))
    cues = []
    if a.sfx:
        with open(a.sfx, encoding="utf-8") as f:
            cues = json.load(f)
        cache = {}
        for c in cues:
            if c["t"] > total:
                continue
            kind = c["type"]
            if kind not in cache:
                cache[kind] = sfx_sound(kind, root)
            mix(sfx, cache[kind], c["t"], float(c.get("gain", 1.0)), float(c.get("pan", 0.0)))
        sfx = filt(sfx.T, "highpass", 120).T  # keep cue rumble out of the bass

    voice = np.zeros((length, 2))
    spans = []
    if a.voice:
        voice, spans = load_voice(a.voice, tl, length)
    duck = duck_curve(length, spans) if spans else 1.0

    bed = reverb(music * a.music_gain, wet=0.22) + reverb(drums, wet=0.08)
    fx = reverb(sfx * a.sfx_gain, wet=0.2)
    out = bed * duck + fx * (duck * 0.5 + 0.5 if spans else 1.0) + voice
    out = out[: n(total)]  # exactly the film's length
    fade = n(0.05)
    out[-fade:] *= np.linspace(1, 0, fade)[:, None]
    out = master(out, a.lufs)

    wavfile.write(a.out, SR, (out * 32767).astype(np.int16))
    if a.stems:
        os.makedirs(a.stems, exist_ok=True)
        for name, x in (("music", music), ("drums", drums), ("sfx", sfx), ("voice", voice)):
            wavfile.write(os.path.join(a.stems, f"{name}.wav"), SR, (np.clip(x[: n(total)], -1, 1) * 32767).astype(np.int16))
    peak = 20 * math.log10(max(1e-9, np.max(np.abs(out))))
    print(f"[synth] {a.out}: {total:.2f}s, {tl['bpm']} BPM, key {a.key} {a.mode}, "
          f"{len(cues)} SFX cues, {len(spans)} voice takes, {lufs(out):.1f} LUFS, peak {peak:.1f} dBFS")


if __name__ == "__main__":
    main()
