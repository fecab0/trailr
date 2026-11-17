#!/usr/bin/env node
'use strict';
// Checks everything a Trailr build needs, without installing anything.
//   node doctor.js
const { spawnSync } = require('child_process');
const { loadPlaywright, launch } = require('./lib/browser');

const rows = [];
const add = (name, ok, detail, fix) => rows.push({ name, ok, detail, fix });
const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { encoding: 'utf8' });
  return r.status === 0 ? (r.stdout || r.stderr || '').trim() : null;
};

(async () => {
  const major = Number(process.versions.node.split('.')[0]);
  add('Node.js >= 18', major >= 18, process.versions.node, 'Install Node.js 18 or newer');

  let pw = null;
  try { pw = loadPlaywright(); add('Playwright', true, 'found'); } catch (e) {
    add('Playwright', false, 'missing', 'npm i -D playwright (or -g), then npx playwright install chromium');
  }
  if (pw) {
    try {
      const b = await launch();
      add('Chromium', true, b.version());
      await b.close();
    } catch (e) {
      add('Chromium', false, e.message.split('\n')[0], 'npx playwright install chromium');
    }
  }

  const ff = run('ffmpeg', ['-version']);
  add('FFmpeg', !!ff, ff ? ff.split('\n')[0] : 'missing', 'Install FFmpeg and put it on PATH');
  const fp = run('ffprobe', ['-version']);
  add('ffprobe', !!fp, fp ? 'found' : 'missing', 'Comes with FFmpeg');

  let py = null;
  for (const cmd of ['python3', 'python', 'py']) {
    const v = run(cmd, ['-c', 'import sys;print(sys.version.split()[0])']);
    if (v && v.startsWith('3.')) { py = cmd; add('Python 3', true, `${cmd} ${v}`); break; }
  }
  if (!py) add('Python 3', false, 'missing', 'Install Python 3.9+');
  else {
    const np = run(py, ['-c', 'import numpy,scipy;print(numpy.__version__,scipy.__version__)']);
    add('NumPy + SciPy', !!np, np || 'missing', `${py} -m pip install numpy scipy`);
  }

  for (const r of rows) console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${r.name.padEnd(16)} ${r.detail}${r.ok ? '' : `  ->  ${r.fix}`}`);
  if (py) console.log(`\nPython command for synth.py: ${py}`);
  const failed = rows.filter((r) => !r.ok);
  if (failed.length) {
    console.log('\nAsk the user before installing anything.');
    process.exit(1);
  }
})();
