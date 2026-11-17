#!/usr/bin/env node
'use strict';
// Preview stills + one contact sheet, before any full render.
//
//   node stills.js <index.html> [--auto] [--times 0.5,2.4,6] [--format horizontal]
//                  [--out work/stills] [--cols 4] [--full 3.2,9.8]
//
// --auto (default when no --times): for every scene a settled frame (60% in) and the two sides
// of its cut (0.12 s before / after the boundary), so transitions get checked, not just holds.
// --full: extra full-resolution frames written next to the sheet for close inspection.
const fs = require('fs');
const path = require('path');
const { launch, openPage, seek } = require('./lib/browser');
const { parseArgs } = require('./lib/args');

const pad = (t) => t.toFixed(2).padStart(7, '0');

(async () => {
  const { pos, opt } = parseArgs(process.argv.slice(2), ['auto']);
  if (!pos[0]) {
    console.error('usage: node stills.js <index.html> [--auto | --times a,b,c] [--format horizontal] [--out dir] [--cols n] [--full a,b]');
    process.exit(2);
  }
  const format = opt.format || 'horizontal';
  const outDir = path.resolve(opt.out || path.join(path.dirname(pos[0]), 'work', 'stills'));
  fs.mkdirSync(outDir, { recursive: true });
  for (const f of fs.readdirSync(outDir)) if (/^(t_|full_).*\.jpg$/.test(f)) fs.unlinkSync(path.join(outDir, f));

  const browser = await launch();
  try {
    const { page, width, height } = await openPage(browser, pos[0], format);
    const tl = await page.evaluate(() => window.TIMELINE);
    const sceneAt = (t) => (tl.scenes.find((s) => t >= s.start && t < s.start + s.dur) || tl.scenes[tl.scenes.length - 1]).id;

    let shots = [];
    if (opt.times) {
      shots = String(opt.times).split(',').map(Number).filter((t) => t >= 0).map((t) => ({ t, label: '' }));
    } else {
      tl.scenes.forEach((s, i) => {
        if (i > 0) shots.push({ t: s.start - 0.12, label: 'cut −' }, { t: s.start + 0.12, label: 'cut +' });
        shots.push({ t: s.start + s.dur * 0.6, label: 'settled' });
      });
      shots.push({ t: Math.max(0, tl.total - 1 / 30), label: 'last frame' });
    }
    shots = shots.filter((s) => s.t >= 0 && s.t <= tl.total).sort((a, b) => a.t - b.t);

    const files = [];
    for (const s of shots) {
      await seek(page, s.t);
      const f = path.join(outDir, `t_${pad(s.t)}.jpg`);
      await page.screenshot({ path: f, type: 'jpeg', quality: 85 });
      files.push({ ...s, f, scene: sceneAt(s.t) });
    }
    if (opt.full) {
      for (const t of String(opt.full).split(',').map(Number)) {
        await seek(page, t);
        await page.screenshot({ path: path.join(outDir, `full_${pad(t)}.jpg`), type: 'jpeg', quality: 95 });
      }
    }

    // Contact sheet laid out in the browser itself: portable (no ffmpeg glob/drawtext on Windows).
    const cols = Math.min(files.length, Number(opt.cols) || (width >= height ? 4 : 7));
    const tw = width >= height ? 480 : 220;
    const th = Math.round((tw * height) / width);
    const cells = files.map((x) => {
      const b64 = fs.readFileSync(x.f).toString('base64');
      return `<figure><img src="data:image/jpeg;base64,${b64}" width="${tw}" height="${th}"><figcaption>${x.t.toFixed(2)}s · ${x.scene}${x.label ? ' · ' + x.label : ''}</figcaption></figure>`;
    }).join('');
    const html = `<!doctype html><meta charset="utf-8"><style>
      body{margin:0;background:#111;color:#ddd;font:14px/1.3 system-ui,sans-serif}
      main{display:grid;grid-template-columns:repeat(${cols},${tw}px);gap:10px;padding:10px;width:max-content}
      figure{margin:0}img{display:block;background:#000}figcaption{padding:4px 2px}</style><main>${cells}</main>`;
    const sheet = await page.context().newPage();
    await sheet.setViewportSize({ width: cols * (tw + 10) + 10, height: 50 }); // fullPage grows to fit
    await sheet.setContent(html, { waitUntil: 'load' });
    const sheetPath = path.join(outDir, 'contact.jpg');
    await sheet.screenshot({ path: sheetPath, type: 'jpeg', quality: 85, fullPage: true });
    console.log(`${files.length} stills in ${outDir}`);
    console.log(`contact sheet: ${sheetPath}`);
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error(e.message || e); process.exit(1); });
