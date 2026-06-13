import { parseEquation, generateValidMoves, getAllPaths } from '../src';

describe('Performance regression tests', () => {
  test('generating valid moves for the quadratic formula should take less than 10 seconds under concurrent load', () => {
    const eq = parseEquation('x = (-b - sqrt(b ^ 2 - 4 * a * c)) / (2 * a)');
    const paths = getAllPaths(eq);

    const start = Date.now();
    
    paths.forEach((path) => {
      generateValidMoves(eq, path);
    });

    const duration = Date.now() - start;
    console.log(`Quadratic formula move generation took ${duration}ms`);

    expect(duration).toBeLessThan(10000); // 10 seconds threshold (unoptimized takes >40s under concurrent load)
  });
});
