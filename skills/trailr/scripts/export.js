#!/usr/bin/env node
'use strict';
// Page -> timeline.json + sfx.json (what synth.py and the voiceover placement read).
//
//   node export.js <index.html> [--out-dir dir] [--format horizontal|vertical|square]
const fs = require('fs');
const path = require('path');
const { launch, openPage } = require('./lib/browser');
const { parseArgs } = require('./lib/args');

(async () => {
  const { pos, opt } = parseArgs(process.argv.slice(2));
  if (!pos[0]) {
    console.error('usage: node export.js <index.html> [--out-dir dir] [--format horizontal]');
    process.exit(2);
  }
  const outDir = path.resolve(opt['out-dir'] || path.dirname(pos[0]));
  const browser = await launch();
  try {
    const { page } = await openPage(browser, pos[0], opt.format || 'horizontal');
    const { timeline, sfx } = await page.evaluate(() => ({ timeline: window.TIMELINE, sfx: window.SFX || [] }));
    const bad = sfx.filter((c) => !(c.t >= 0) || !c.type);
    if (bad.length) throw new Error(`SFX cues need {t >= 0, type}: ${JSON.stringify(bad.slice(0, 3))}`);
    const late = sfx.filter((c) => c.t > timeline.total);
    if (late.length) console.warn(`[trailr] ${late.length} SFX cue(s) start after the end (${timeline.total}s) and will be skipped`);
    sfx.sort((a, b) => a.t - b.t);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'timeline.json'), JSON.stringify(timeline, null, 2));
    fs.writeFileSync(path.join(outDir, 'sfx.json'), JSON.stringify(sfx, null, 2));
    const types = {};
    sfx.forEach((c) => { types[c.type] = (types[c.type] || 0) + 1; });
    console.log(`timeline.json: ${timeline.scenes.length} scenes, ${timeline.total}s at ${timeline.bpm} BPM`);
    console.log(`sfx.json: ${sfx.length} cues ${JSON.stringify(types)}`);
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error(e.message || e); process.exit(1); });
