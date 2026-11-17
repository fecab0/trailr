#!/usr/bin/env node
'use strict';
// Composition -> MP4. Parallel workers each capture a contiguous chunk of frames as JPEG and pipe
// them into their own ffmpeg; chunks are joined with the concat demuxer, the soundtrack is muxed,
// and one final encode makes the delivery file.
//
//   node render.js <index.html> --out film.mp4 [--format horizontal|vertical|square] [--fps 60]
//                  [--audio soundtrack.wav] [--workers N] [--from s] [--to s] [--draft] [--work dir]
//                  [--keep]
//
// --draft: faster encode (crf 23, veryfast) for review renders. --from/--to render a slice.
// Pixel sizes come from --format; the page reads the same value from ?format=.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { launch, openPage, seek } = require('./lib/browser');
const { parseArgs } = require('./lib/args');

function ffmpeg(args, opts = {}) {
  const p = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: ['pipe', 'inherit', 'inherit'], ...opts });
  const done = new Promise((res, rej) => {
    p.on('error', rej);
    p.on('close', (code) => (code === 0 ? res() : rej(new Error(`ffmpeg exited with ${code}: ffmpeg ${args.join(' ')}`))));
  });
  return { p, done };
}

const write = (stream, buf) => new Promise((res, rej) => {
  if (stream.write(buf)) res();
  else { stream.once('drain', res); stream.once('error', rej); }
});

(async () => {
  const { pos, opt } = parseArgs(process.argv.slice(2), ['draft', 'keep']);
  if (!pos[0] || !opt.out) {
    console.error('usage: node render.js <index.html> --out film.mp4 [--format horizontal] [--fps 60] [--audio a.wav] [--workers N] [--from s] [--to s] [--draft]');
    process.exit(2);
  }
  if (spawnSync('ffmpeg', ['-version']).status !== 0) throw new Error('ffmpeg not found on PATH');

  const page0 = path.resolve(pos[0]);
  const out = path.resolve(opt.out);
  const format = opt.format || 'horizontal';
  const fps = Number(opt.fps) || 60;
  const work = path.resolve(opt.work || path.join(path.dirname(page0), 'work', 'render'));
  fs.mkdirSync(work, { recursive: true });

  const browser = await launch();
  const t0 = Date.now();
  try {
    // Probe the timeline once.
    const probe = await openPage(browser, page0, format);
    const total = await probe.page.evaluate(() => window.TIMELINE.total);
    await probe.context.close();

    const from = opt.from != null ? Number(opt.from) : 0;
    const to = Math.min(opt.to != null ? Number(opt.to) : total, total);
    const first = Math.round(from * fps);
    const last = Math.round(to * fps); // exclusive
    const nFrames = last - first;
    if (nFrames <= 0) throw new Error(`Nothing to render between ${from}s and ${to}s`);

    const cores = os.cpus().length;
    const workers = Math.max(1, Math.min(Number(opt.workers) || Math.max(1, cores - 1), 8, Math.ceil(nFrames / 30)));
    const per = Math.ceil(nFrames / workers);
    console.log(`[trailr] ${nFrames} frames (${(nFrames / fps).toFixed(2)}s) at ${fps}fps, ${format}, ${workers} workers`);

    let doneFrames = 0;
    let lastPct = -1;
    const tick = () => {
      doneFrames++;
      const pct = Math.floor((doneFrames / nFrames) * 20) * 5;
      if (pct !== lastPct) {
        lastPct = pct;
        const el = (Date.now() - t0) / 1000;
        const eta = doneFrames ? (el / doneFrames) * (nFrames - doneFrames) : 0;
        process.stdout.write(`  ${pct}%  ${doneFrames}/${nFrames}  ${el.toFixed(0)}s elapsed, ~${eta.toFixed(0)}s left\n`);
      }
    };

    const chunks = [];
    const jobs = [];
    for (let w = 0; w < workers; w++) {
      const a = first + w * per;
      const b = Math.min(last, a + per);
      if (a >= b) break;
      const file = path.join(work, `chunk_${String(w).padStart(3, '0')}.mp4`);
      chunks.push(file);
      jobs.push((async () => {
        const { page, context } = await openPage(browser, page0, format);
        const enc = ffmpeg(['-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
          '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '14', '-pix_fmt', 'yuv420p', file]);
        for (let f = a; f < b; f++) {
          await seek(page, f / fps);
          const buf = await page.screenshot({ type: 'jpeg', quality: 95 });
          await write(enc.p.stdin, buf);
          tick();
        }
        enc.p.stdin.end();
        await enc.done;
        await context.close();
      })());
    }
    await Promise.all(jobs);

    const list = path.join(work, 'chunks.txt');
    fs.writeFileSync(list, chunks.map((c) => `file '${c.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n'));
    const dur = (nFrames / fps).toFixed(3);
    const args = ['-f', 'concat', '-safe', '0', '-i', list];
    if (opt.audio) args.push('-ss', String(from), '-t', dur, '-i', path.resolve(opt.audio));
    args.push('-map', '0:v:0');
    if (opt.audio) args.push('-map', '1:a:0', '-c:a', 'aac', '-b:a', '192k');
    args.push('-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', String(fps),
      ...(opt.draft ? ['-preset', 'veryfast', '-crf', '23'] : ['-preset', 'slow', '-crf', '17']),
      '-t', dur, '-movflags', '+faststart', out);
    console.log('[trailr] final encode…');
    await ffmpeg(args).done;
    if (!opt.keep) chunks.forEach((c) => fs.rmSync(c, { force: true }));

    // Verify the file, not just the frames.
    const pr = spawnSync('ffprobe', ['-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries',
      'stream=nb_read_frames,width,height', '-of', 'json', out]);
    const info = JSON.parse(pr.stdout.toString() || '{}').streams?.[0] || {};
    const mb = fs.statSync(out).size / 1048576;
    const frames = Number(info.nb_read_frames);
    console.log(`[trailr] ${out}\n  ${info.width}x${info.height}, ${frames} frames (expected ${nFrames}), ${mb.toFixed(1)} MB, ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    if (frames !== nFrames) console.warn('[trailr] WARNING: frame count differs from the timeline; check the render.');
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error(e.message || e); process.exit(1); });
