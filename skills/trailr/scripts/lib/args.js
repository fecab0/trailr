'use strict';
// Tiny argv parser: positional args plus --key value / --flag.
function parseArgs(argv, flags = []) {
  const pos = [];
  const opt = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      if (flags.includes(key) || i + 1 >= argv.length || argv[i + 1].startsWith('--')) opt[key] = true;
      else opt[key] = argv[++i];
    } else pos.push(a);
  }
  return { pos, opt };
}

module.exports = { parseArgs };
