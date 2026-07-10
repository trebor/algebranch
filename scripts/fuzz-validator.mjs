#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

/**
 * fuzz-validator.mjs — long-budget randomized fuzz of the move validator (#498).
 *
 * The deterministic, seeded subset lives in the CI gate
 * (`math-engine/tests/fuzz-validator.test.ts`). This is its unbounded sibling:
 * run it before a broadcast launch to burn CPU hunting for an accepted-but-wrong
 * move the seeded subset didn't happen to hit.
 *
 * It generates two guaranteed-verdict families and checks the validator agrees:
 *   - non-equivalent: a real equation mutated so its solution set MUST change →
 *     the validator must REJECT. An acceptance is a false-accept (the dangerous
 *     class: invalid algebra waved through).
 *   - equivalent: a real equation transformed so its solution set is PRESERVED →
 *     the validator must ACCEPT. A rejection is a false-reject (over-tightening).
 *
 * Any anomaly is printed with its seed and pair so it can be frozen into a named
 * regression case, then the run exits nonzero.
 *
 * Usage:
 *   node scripts/fuzz-validator.mjs --seconds 300
 *   node scripts/fuzz-validator.mjs --seconds 60 --seed 12345
 *
 * Requires the built engine (`npm run build` at least once): imports
 * math-engine/dist.
 */

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const enginePath = path.join(here, '..', 'math-engine', 'dist', 'index.js');

let engine;
try {
  engine = require(enginePath);
} catch (err) {
  console.error(`Could not load the built engine at ${enginePath}.`);
  console.error('Run `npm run build` (or `npm run build --workspace=math-engine`) first.');
  console.error(String(err));
  process.exit(2);
}
const { parseEquation, areEquationsEquivalent } = engine;

const DEFAULT_SECONDS = 30;
const REPORT_EVERY = 20000;
const COEFF_MIN = -8;
const COEFF_MAX = 8;
const SCALE_MIN = 2;
const SCALE_MAX = 7;
const VAR_NAMES = ['x', 'y', 't', 'a'];

const parseArgs = () => {
  const args = process.argv.slice(2);
  const opts = { seconds: DEFAULT_SECONDS, seed: (Date.now() >>> 0) };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--seconds') opts.seconds = Number(args[++i]);
    else if (args[i] === '--seed') opts.seed = Number(args[++i]) >>> 0;
    else {
      console.error(`Unknown argument: ${args[i]}`);
      process.exit(2);
    }
  }
  if (!Number.isFinite(opts.seconds) || opts.seconds <= 0) {
    console.error('--seconds must be a positive number');
    process.exit(2);
  }
  return opts;
};

const makeRng = (seed) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const randInt = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
const randNonZero = (rng, lo, hi) => {
  let v = 0;
  while (v === 0) v = randInt(rng, lo, hi);
  return v;
};
const pick = (rng, items) => items[Math.floor(rng() * items.length)];
const lit = (n) => `(${n})`;

const makeLinear = (rng) => ({
  a: randNonZero(rng, COEFF_MIN, COEFF_MAX),
  b: randInt(rng, COEFF_MIN, COEFF_MAX),
  c: randInt(rng, COEFF_MIN, COEFF_MAX),
  v: pick(rng, VAR_NAMES),
});
const linearStr = (a, b, c, v) => `${lit(a)}*${v} + ${lit(b)} = ${lit(c)}`;

/** Guaranteed solution-set-ALTERING mutation → validator must reject. */
const generateNonEquivalentPair = (rng) => {
  const { a, b, c, v } = makeLinear(rng);
  const s1 = linearStr(a, b, c, v);
  if (randInt(rng, 0, 1) === 0) {
    const d = randNonZero(rng, 1, COEFF_MAX);
    return { s1, s2: linearStr(a, b, c + d, v) };
  }
  const e = randNonZero(rng, 1, COEFF_MAX);
  return { s1, s2: linearStr(a + e, b, c, v) };
};

/** Guaranteed solution-set-PRESERVING transform → validator must accept. */
const generateEquivalentPair = (rng) => {
  const { a, b, c, v } = makeLinear(rng);
  const s1 = linearStr(a, b, c, v);
  const mode = randInt(rng, 0, 2);
  if (mode === 0) {
    const k = randNonZero(rng, SCALE_MIN, SCALE_MAX);
    return { s1, s2: `${lit(k)}*(${lit(a)}*${v} + ${lit(b)}) = ${lit(k)}*${lit(c)}` };
  }
  if (mode === 1) {
    const d = randInt(rng, COEFF_MIN, COEFF_MAX);
    return { s1, s2: `${lit(a)}*${v} + ${lit(b)} + ${lit(d)} = ${lit(c)} + ${lit(d)}` };
  }
  return { s1, s2: `${lit(c)} = ${lit(a)}*${v} + ${lit(b)}` };
};

const isEquiv = (s1, s2) => areEquationsEquivalent(parseEquation(s1), parseEquation(s2));

const run = () => {
  const { seconds, seed } = parseArgs();
  const rng = makeRng(seed);
  const deadline = Date.now() + seconds * 1000;
  console.log(`fuzz-validator: seed=${seed} budget=${seconds}s`);

  const anomalies = [];
  let checks = 0;

  while (Date.now() < deadline) {
    // Non-equivalent family: acceptance is a false-accept.
    const neg = generateNonEquivalentPair(rng);
    if (isEquiv(neg.s1, neg.s2)) {
      anomalies.push(`FALSE-ACCEPT: [${neg.s1}] wrongly ≡ [${neg.s2}]`);
    }
    // Equivalent family: rejection is a false-reject.
    const pos = generateEquivalentPair(rng);
    if (!isEquiv(pos.s1, pos.s2)) {
      anomalies.push(`FALSE-REJECT: [${pos.s1}] wrongly ≢ [${pos.s2}]`);
    }
    checks += 2;
    if (checks % REPORT_EVERY === 0) {
      console.log(`  ...${checks} checks, ${anomalies.length} anomalies`);
    }
  }

  console.log(`Done: ${checks} checks in ${seconds}s.`);
  if (anomalies.length === 0) {
    console.log('No anomalies — validator held.');
    process.exit(0);
  }
  console.error(`\n${anomalies.length} ANOMALIES (freeze each into a named regression case):`);
  for (const a of anomalies.slice(0, 50)) console.error(`  ${a}`);
  if (anomalies.length > 50) console.error(`  ...and ${anomalies.length - 50} more`);
  console.error(`\nReproduce with: node scripts/fuzz-validator.mjs --seconds ${seconds} --seed ${seed}`);
  process.exit(1);
};

run();
