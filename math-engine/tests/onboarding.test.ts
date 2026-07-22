import * as math from 'mathjs';
import { ONBOARDING_CHAPTERS, OnboardingChapter, OnboardingStep } from '../../ui/src/constants/onboarding';
import {
  parseEquation,
  ensureNodeIds,
  generateValidMoves,
  getReducibleOptions,
  getIsolatedDefinition,
  getSubstitutionOptions,
  getNodeByPath,
  equationToString,
  Equation,
  SubstitutionFact
} from '../src';

const strip = (s: string) => s.replace(/\s+/g, '');

/**
 * Derives the equation a step is expected to produce, using the exact same
 * mechanisms the live UI offers: reduce/distribute/identity handles, valid
 * transposition targets for the step's selection, or a global operation.
 * Returns null (with diagnostics collected) when the transition is unreachable.
 */
const deriveStep = (
  eq: Equation,
  step: OnboardingStep,
  pendingTargets: Record<string, Equation> | null,
  facts: SubstitutionFact[],
  diagnostics: string[]
): Equation | null => {
  const nextStr = strip(step.nextEquation);

  // 1. A reduce handle on the current state
  const reductions = getReducibleOptions(eq);
  for (const actions of Object.values(reductions)) {
    const hit = actions.find(a => strip(equationToString(a.simplified)) === nextStr);
    if (hit) return hit.simplified;
  }

  // 1.5 A substitution handle fed by the chapter's facts (#3)
  if (facts.length > 0) {
    const substitutions = getSubstitutionOptions(eq, facts);
    for (const options of Object.values(substitutions)) {
      const hit = options.find(o => strip(equationToString(o.substituted)) === nextStr);
      if (hit) return hit.substituted;
    }
  }

  // 2. A transposition target from the prior selection (or this step's own selection)
  let targets = pendingTargets;
  const selPath = step.selectPath || step.highlightPath;
  if (!targets && selPath) {
    const moves = generateValidMoves(eq, selPath);
    delete moves[selPath];
    targets = moves;
  }
  if (targets) {
    const hit = Object.values(targets).find(t => strip(equationToString(t)) === nextStr);
    if (hit) return hit;
    diagnostics.push(
      `targets of '${selPath}': [${Object.values(targets).map(t => equationToString(t)).join(' | ')}]`
    );
  }

  // 3. A global operation applied to both sides (mirrors applyGlobalOpAtom)
  if (step.globalOp) {
    const { type, term, power } = step.globalOp;
    const effectivePower = power ?? 2;
    let result: Equation | null = null;

    if (type === 'swap') {
      result = { lhs: eq.rhs, rhs: eq.lhs, relation: eq.relation };
    } else if (type === 'sqrt' || type === 'root') {
      result = effectivePower === 2
        ? { lhs: new math.FunctionNode('sqrt', [eq.lhs]), rhs: new math.FunctionNode('sqrt', [eq.rhs]) }
        : {
            lhs: new math.FunctionNode('nthRoot', [eq.lhs, new math.ConstantNode(effectivePower)]),
            rhs: new math.FunctionNode('nthRoot', [eq.rhs, new math.ConstantNode(effectivePower)])
          };
    } else if (type === 'square' || type === 'power') {
      const exp = new math.ConstantNode(effectivePower);
      result = {
        lhs: new math.OperatorNode('^', 'pow', [eq.lhs, exp]),
        rhs: new math.OperatorNode('^', 'pow', [eq.rhs, exp])
      };
    } else if (term) {
      const opMap = { add: ['+', 'add'], sub: ['-', 'subtract'], mul: ['*', 'multiply'], div: ['/', 'divide'] } as const;
      const [op, fn] = opMap[type];
      const parsedTerm = math.parse(term);
      result = {
        lhs: new math.OperatorNode(op, fn, [eq.lhs, parsedTerm]),
        rhs: new math.OperatorNode(op, fn, [eq.rhs, parsedTerm])
      };
    }

    if (result) {
      if (strip(equationToString(result)) === nextStr) return result;
      diagnostics.push(`globalOp result: '${equationToString(result)}'`);
    }
  }

  diagnostics.push(
    `reduce results: [${Object.values(reductions).flat().map(a => equationToString(a.simplified)).join(' | ')}]`
  );
  return null;
};

describe('Onboarding chapter derivation chains', () => {
  ONBOARDING_CHAPTERS.forEach((chapter: OnboardingChapter) => {
    describe(`Chapter '${chapter.id}' (${chapter.title})`, () => {
      test('every step is reachable through real engine mechanisms', () => {
        let eq = parseEquation(chapter.initialEquation);
        let pendingTargets: Record<string, Equation> | null = null;

        // Chapter facts must each parse to a valid isolated definition (#3)
        const facts: SubstitutionFact[] = (chapter.facts ?? []).map((f) => {
          const def = getIsolatedDefinition(ensureNodeIds(parseEquation(f)));
          expect(def ? true : `chapter fact '${f}' is not an isolated definition`).toBe(true);
          return { ...def! };
        });

        chapter.steps.forEach((step, i) => {
          const label = `step ${i} ('${step.title}')`;

          // highlightPath must exist on the equation state the step starts from
          if (step.highlightPath) {
            const node = getNodeByPath(eq, step.highlightPath);
            expect(
              node ? true : `${label}: highlightPath '${step.highlightPath}' not found in '${equationToString(eq)}'`
            ).toBe(true);
          }

          if (!step.nextEquation) return; // chapter-complete step

          const nextStr = strip(step.nextEquation);
          if (nextStr === strip(equationToString(eq))) {
            // No-op step: a selection prompt must offer at least one valid move
            if (step.highlightPath) {
              const moves = generateValidMoves(eq, step.highlightPath);
              delete moves[step.highlightPath];
              expect(
                Object.keys(moves).length > 0
                  ? true
                  : `${label}: selection '${step.highlightPath}' offers no valid moves in '${equationToString(eq)}'`
              ).toBe(true);
              pendingTargets = moves;
            }
            return;
          }

          const diagnostics: string[] = [];
          const next = deriveStep(eq, step, pendingTargets, facts, diagnostics);
          expect(
            next
              ? true
              : `${label}: cannot reach '${step.nextEquation}' from '${equationToString(eq)}'.\n  ${diagnostics.join('\n  ')}`
          ).toBe(true);

          eq = next!;
          pendingTargets = null;
        });
      });
    });
  });
});
