'use strict';
// Single source of truth for timing. build-script.js uses it to turn script.json into
// script.js (window.SCRIPT + window.TIMING); the page reads TIMING and never recomputes it.

const BPM_BY_PACE = { slow: 100, normal: 120, fast: 140 };
const SECTIONS = ['intro', 'problem', 'breath', 'reveal', 'groove', 'build', 'end'];
const r3 = (x) => Math.round(x * 1000) / 1000;

function computeTiming(script) {
  if (!script || !Array.isArray(script.scenes) || script.scenes.length === 0) {
    throw new Error('script.json needs a non-empty "scenes" array');
  }
  const pace = script.pace || 'normal';
  const bpm = script.bpm != null ? Number(script.bpm) : BPM_BY_PACE[pace];
  if (!(bpm > 0)) throw new Error(`Unknown pace "${pace}" (use slow, normal or fast, or set "bpm")`);
  const beat = 60 / bpm;
  const bar = 4 * beat;
  const seen = new Set();
  let t = 0;
  const scenes = script.scenes.map((row, i) => {
    const id = row.scene;
    if (!id || typeof id !== 'string') throw new Error(`Scene #${i + 1} has no "scene" id`);
    if (seen.has(id)) throw new Error(`Duplicate scene id "${id}"`);
    seen.add(id);
    if (row.section != null && !SECTIONS.includes(row.section)) {
      throw new Error(`Scene "${id}": unknown section "${row.section}" (use ${SECTIONS.join(', ')})`);
    }
    let dur;
    let rounded = false;
    if (row.sec != null) {
      if (!(row.sec > 0)) throw new Error(`Scene "${id}": "sec" must be > 0`);
      // a sec override is rounded to whole beats so every later cut stays on the grid
      dur = Math.max(1, Math.round(row.sec / beat)) * beat;
      rounded = Math.abs(dur - row.sec) > 0.001;
    } else {
      if (!(row.bars > 0)) throw new Error(`Scene "${id}": needs "bars" > 0 (or a "sec" override)`);
      dur = row.bars * bar;
    }
    const s = {
      id,
      start: r3(t),
      dur: r3(dur),
      bars: row.bars != null ? row.bars : null,
      sec: row.sec != null ? row.sec : null,
      rounded,
      section: row.section || null,
    };
    t += dur;
    return s;
  });
  return { pace, bpm, beat: r3(beat), bar: r3(bar), total: r3(t), scenes };
}

// Words a viewer must read. Accent markers (*word*) don't count as words.
const words = (line) => String(line).replace(/\*/g, '').trim().split(/\s+/).filter(Boolean).length;
// ~0.3 s per word + 0.5 s, never under 1.5 s for a headline
const minRead = (line) => Math.max(1.5, 0.3 * words(line) + 0.5);

function readTimeWarnings(script, timing) {
  const out = [];
  script.scenes.forEach((row, i) => {
    const s = timing.scenes[i];
    const lines = (row.text || []).filter((l) => String(l).trim());
    lines.forEach((line) => {
      const need = minRead(line);
      if (need > s.dur + 1e-6) {
        out.push(`"${s.id}": "${line}" needs ~${need.toFixed(1)} s to read, the scene lasts ${s.dur.toFixed(2)} s`);
      }
    });
    const total = lines.reduce((a, l) => a + minRead(l), 0);
    if (lines.length > 1 && total > s.dur * 1.25) {
      out.push(`"${s.id}": its ${lines.length} lines need ~${total.toFixed(1)} s if shown one after another (scene ${s.dur.toFixed(2)} s)`);
    }
  });
  return out;
}

module.exports = { BPM_BY_PACE, SECTIONS, computeTiming, readTimeWarnings, minRead };
