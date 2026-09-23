// Bridge for pytest: reads {"fn": name, "args": [...]} from stdin, calls src/logic/search.ts, prints JSON.
// Run with: node --experimental-strip-types tests/js/harness.mjs
import { readFileSync } from 'node:fs';
import * as search from '../../src/logic/search.ts';

const { fn, args } = JSON.parse(readFileSync(0, 'utf8'));
if (typeof search[fn] !== 'function') {
  console.error(`unknown function: ${fn}`);
  process.exit(2);
}
process.stdout.write(JSON.stringify(search[fn](...args)));
