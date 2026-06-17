import * as fs from 'fs';
import * as path from 'path';

/**
 * Single-app-version invariant (issue #157): the monorepo uses one unified
 * version number. The root `package.json` is the single source of truth that
 * the UI surfaces at runtime (via next.config `env` → NEXT_PUBLIC_APP_VERSION);
 * the workspace manifests must stay in lockstep with it. This guard fails fast
 * if the versions ever drift again.
 */
describe('monorepo version sync', () => {
  const repoRoot = path.resolve(__dirname, '..', '..');

  const readVersion = (relPath: string): string => {
    const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, relPath), 'utf8'));
    return pkg.version;
  };

  const rootVersion = readVersion('package.json');

  it('uses a valid SemVer string at the root (single source of truth)', () => {
    expect(rootVersion).toMatch(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
  });

  it.each([
    ['math-engine/package.json'],
    ['ui/package.json'],
  ])('keeps %s in lockstep with the root version', (relPath) => {
    expect(readVersion(relPath)).toBe(rootVersion);
  });
});
