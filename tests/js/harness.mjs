// Bridge for pytest: reads {"fn": name, "args": [...]} from stdin, calls a function from src/logic/, prints JSON.
// Run with: node --experimental-strip-types tests/js/harness.mjs
import { readFileSync } from 'node:fs';
import * as search from '../../src/logic/search.ts';
import * as color from '../../src/logic/color.ts';

const fns = { ...search, ...color };

const { fn, args } = JSON.parse(readFileSync(0, 'utf8'));
if (typeof fns[fn] !== 'function') {
  console.error(`unknown function: ${fn}`);
  process.exit(2);
}
process.stdout.write(JSON.stringify(fns[fn](...args)));
