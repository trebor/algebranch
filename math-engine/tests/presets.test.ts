import * as math from 'mathjs';
import { PRESET_LIST } from '../../ui/src/constants/presets';
import { 
  parseEquation, 
  getAllPaths, 
  getNodeByPath, 
  replaceNodeAtPath, 
  areEquationsEquivalent,
  tryDistribution
} from '../src';
import { HIGH_SCHOOL_IDENTITIES } from '../src/rules';
import { matchPattern, instantiatePattern, tryExpressAsPower } from '../src/matcher';

describe('Algebraic Identity Presets Integration Tests', () => {
  const identityPresets = PRESET_LIST.filter(p => p.category === 'Algebraic Identities');

  test('should verify at least one identity is offered for every identity preset equation', () => {
    expect(identityPresets.length).toBeGreaterThan(0);

    identityPresets.forEach((preset) => {
      const eq = parseEquation(preset.equation);
      const allPaths = getAllPaths(eq);
      
      let foundIdentity = false;
      const matchedIdentities: string[] = [];

      allPaths.forEach((path) => {
        const node = getNodeByPath(eq, path);

        // 1. Try high-school algebraic identity matches
        for (const rule of HIGH_SCHOOL_IDENTITIES) {
          const bindings = matchPattern(rule.sourcePattern, node);
          if (bindings) {
            const instantiated = instantiatePattern(rule.targetPattern, bindings);
            const newEq = replaceNodeAtPath(eq, path, instantiated);
            if (areEquationsEquivalent(eq, newEq)) {
              foundIdentity = true;
              matchedIdentities.push(rule.name);
            }
          }
        }

        // 2. Try expressing perfect power constants (e.g. 9 -> 3^2)
        const powerForm = tryExpressAsPower(node);
        if (powerForm) {
          const newEq = replaceNodeAtPath(eq, path, powerForm);
          if (areEquationsEquivalent(eq, newEq)) {
            foundIdentity = true;
            matchedIdentities.push('Express as Power');
          }
        }
      });

      if (!foundIdentity) {
        throw new Error(
          `Preset "${preset.label}" with equation "${preset.equation}" did not offer any valid rewrite identities!`
        );
      }

      console.log(`Preset: "${preset.label}" -> Offered identities: ${matchedIdentities.join(', ')}`);
    });
  });
});
