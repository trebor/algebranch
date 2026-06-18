import { parseEquation, generateValidMoves, getAllPaths } from '../src';

describe('Performance regression tests', () => {
  test('generating valid moves for the quadratic formula should take less than 25 seconds under concurrent load', () => {
    const eq = parseEquation('x = (-b - sqrt(b ^ 2 - 4 * a * c)) / (2 * a)');
    const paths = getAllPaths(eq);

    const start = Date.now();
    
    paths.forEach((path) => {
      generateValidMoves(eq, path);
    });

    const duration = Date.now() - start;
    console.log(`Quadratic formula move generation took ${duration}ms`);

    // 25s threshold: a regression guard, not a microbenchmark. The unoptimized
    // path takes >40s under concurrent load, so this still catches a regression,
    // while leaving generous headroom over shared CI runners (~11s observed,
    // vs ~7s locally) so normal runner variance doesn't flake the build.
    expect(duration).toBeLessThan(25000);
  });
});
