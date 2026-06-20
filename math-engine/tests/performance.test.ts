import { parseEquation, generateValidMoves, getAllPaths } from '../src';

describe('Performance regression tests', () => {
  test('generating valid moves for the quadratic formula should take less than 15 seconds under concurrent load', () => {
    const eq = parseEquation('x = (-b - sqrt(b ^ 2 - 4 * a * c)) / (2 * a)');
    const paths = getAllPaths(eq);

    const start = Date.now();

    paths.forEach((path) => {
      generateValidMoves(eq, path);
    });

    const duration = Date.now() - start;
    console.log(`Quadratic formula move generation took ${duration}ms`);

    // 15s threshold: a coarse regression guard, not a microbenchmark. The #188
    // equivalence-check optimizations (hasValidMove short-circuit + reject-only
    // pre-filter) dropped this to ~4–5s under concurrent jest load locally (the
    // pre-#188 post-#175 baseline was ~7s local / ~11s CI; fully unoptimized was
    // >40s). 15s keeps generous headroom over shared CI runner variance so the
    // build doesn't flake, while still catching a gross regression. The precise
    // win is pinned by benchmarking the compiled bundle in plain node (~1.5s →
    // ~0.9s for generateValidMoves over all paths), which the noisy ts-jest
    // number can't measure reliably.
    expect(duration).toBeLessThan(15000);
  });
});
