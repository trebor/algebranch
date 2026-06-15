import * as math from 'mathjs';
import { Equation, getNodeByPath, replaceNodeAtPath } from './tree';
import { ReductionOption, isConstantSubtree } from './simplify';
import { GlobalOpParams } from './globalOps';

/**
 * A structured, human-readable description of the operation that transforms one
 * equation into the next. Two kinds:
 *  - `bothSides`: an inverse operation applied to both sides (transposition /
 *    global ops), e.g. "subtract 4 from both sides".
 *  - `rewrite`: an in-place rewrite of a sub-expression (evaluate / simplify /
 *    distribute / identity / quadratic).
 */
export type StepChange =
  | {
      readonly kind: 'bothSides';
      readonly op: 'add' | 'subtract' | 'multiply' | 'divide' | 'power' | 'root';
      // For add/subtract/multiply/divide: the term. For power/root: the
      // exponent / root index (e.g. '2' = square / square-root). Always a
      // strictly parsable symbolic string.
      readonly operand: string;
      readonly text: string;
      // Domain restrictions the step relies on, e.g. ['x ≠ 0'] when dividing
      // both sides by a variable expression (#63). Omitted when there are none.
      readonly assumptions?: readonly string[];
    }
  | {
      readonly kind: 'rewrite';
      readonly op: 'evaluate' | 'simplify' | 'distribute' | 'identity' | 'quadratic' | 'substitute';
      readonly detail?: string;
      readonly text: string;
      // Domain restrictions the step relies on, e.g. ['x ≠ 0'] when a variable
      // factor is cancelled out of a fraction (#63). Omitted when there are none.
      readonly assumptions?: readonly string[];
    };

const nodeToString = (node: math.MathNode | null): string => (node ? node.toString() : '');

/** Strip whitespace and parentheses for structural string comparison. */
const cleanStr = (s: string): string => s.replace(/[\s()]/g, '');

/**
 * Collects every non-constant divisor (the denominator of a `/` node whose
 * value depends on a variable) within a subtree, keyed by its cleaned string
 * form so duplicates collapse. These are the expressions a cancellation or
 * division silently assumes to be non-zero.
 */
const collectVariableDivisors = (node: math.MathNode): Map<string, math.MathNode> => {
  const out = new Map<string, math.MathNode>();
  node.traverse((n) => {
    if (n.type === 'OperatorNode' && (n as math.OperatorNode).op === '/') {
      const denom = (n as math.OperatorNode).args[1];
      if (denom && !isConstantSubtree(denom)) {
        out.set(cleanStr(denom.toString()), denom);
      }
    }
  });
  return out;
};

/** Render a list of non-zero restriction operands as `x ≠ 0` strings. */
const toRestrictionStrings = (denoms: Iterable<math.MathNode>): string[] =>
  Array.from(denoms, (d) => `${d.toString()} ≠ 0`);

/**
 * The smallest sub-expression that fully contains the change from `eq` to
 * `simplified`, as a path. Reductions are tagged by the *removed* node's path
 * (e.g. the leaf `1` dropped from `m * x * 1`), which makes a naive before/after
 * at that path read nonsensically ("1 → x") once the tree reshapes — and hides
 * a cancelled divisor from the ≠0 detection. Walking up from `startPath` to the
 * deepest ancestor whose subtree, spliced from `simplified` back into `eq`,
 * reproduces `simplified`, recovers the real affected sub-expression
 * (`m * x * 1 → m * x`, or `m * x * 1 / x → m * 1`). The whole changed side
 * always satisfies this, so a real containing path is always found.
 */
export const findMinimalChangedPath = (
  eq: Equation,
  simplified: Equation,
  startPath: string,
): string => {
  const target = `${simplified.lhs.toString()} = ${simplified.rhs.toString()}`;
  let parts = startPath.split('/');
  while (parts.length >= 1) {
    const a = parts.join('/');
    try {
      const spliced = replaceNodeAtPath(eq, a, getNodeByPath(simplified, a));
      if (`${spliced.lhs.toString()} = ${spliced.rhs.toString()}` === target) return a;
    } catch {
      /* path may not exist in `simplified` after a reshape; keep walking up */
    }
    if (parts.length === 1) break;
    parts = parts.slice(0, -1);
  }
  return startPath;
};

/**
 * Domain restrictions introduced by an in-place reduction (#63): a variable
 * denominator present in the affected sub-expression *before* the move but gone
 * *after* it was cancelled away. Such a cancellation is only valid when that
 * expression is non-zero, so we surface the assumption rather than hiding it.
 * Compares over the *minimal changed sub-expression* (not the raw, possibly
 * leaf-aliased option path) so a cancellation like `m * x * 1 / x → m * 1` is
 * detected even though it was tagged at a leaf. Returns an empty array when the
 * move adds no restriction (e.g. distributing a fraction keeps the denominator).
 */
export const domainRestrictionsForReduction = (eq: Equation, option: ReductionOption): string[] => {
  const path = findMinimalChangedPath(eq, option.simplified, option.path);
  let before: math.MathNode;
  let after: math.MathNode;
  try {
    before = getNodeByPath(eq, path);
    after = getNodeByPath(option.simplified, path);
  } catch {
    return [];
  }
  const beforeDivisors = collectVariableDivisors(before);
  const afterDivisors = collectVariableDivisors(after);
  const cancelled: math.MathNode[] = [];
  for (const [key, denom] of beforeDivisors) {
    if (!afterDivisors.has(key)) cancelled.push(denom);
  }
  return toRestrictionStrings(cancelled);
};

/**
 * Describe a transposition (a term moving across `=`) as the inverse operation
 * applied to both sides. Returns null for same-side rearrangements or shapes we
 * don't yet describe precisely (caller can fall back to a generic label).
 */
export const describeTransposition = (
  eq: Equation,
  sourcePath: string,
  targetPath: string,
): StepChange | null => {
  const srcSide = sourcePath.split('/')[0];
  const tgtSide = targetPath.split('/')[0];
  if (srcSide !== 'lhs' && srcSide !== 'rhs') return null;
  // Only a cross-equals move is a clean both-sides operation.
  if (srcSide === tgtSide) return null;

  const parts = sourcePath.split('/');
  if (parts.length < 2) return null; // moving an entire side — no single operand

  const childIndex = parseInt(parts[parts.length - 1], 10);
  const parentPath = parts.slice(0, -1).join('/');

  let parent: math.MathNode;
  let moved: math.MathNode;
  try {
    parent = getNodeByPath(eq, parentPath);
    moved = getNodeByPath(eq, sourcePath);
  } catch {
    return null;
  }
  if (!parent || parent.type !== 'OperatorNode') return null;

  const parentOp = (parent as math.OperatorNode).op;
  const operand = nodeToString(moved);

  // Inverse of the operator that bound the moved term to its side.
  let op: 'add' | 'subtract' | 'multiply' | 'divide' | null = null;
  switch (parentOp) {
    case '+':
      op = 'subtract';
      break;
    case '-':
      // Right child (subtrahend) → add to both sides. Minuend is rarer; defer.
      op = childIndex === 1 ? 'add' : null;
      break;
    case '*':
      op = 'divide';
      break;
    case '/':
      // Denominator (right child) → multiply; numerator → divide.
      op = childIndex === 1 ? 'multiply' : 'divide';
      break;
    default:
      op = null;
  }
  if (!op) return null;

  const baseText =
    op === 'subtract'
      ? `subtract ${operand} from both sides`
      : op === 'add'
        ? `add ${operand} to both sides`
        : op === 'multiply'
          ? `multiply both sides by ${operand}`
          : `divide both sides by ${operand}`;

  // Dividing both sides by a variable expression assumes it is non-zero (#63).
  const assumptions =
    op === 'divide' && !isConstantSubtree(moved) ? [`${operand} ≠ 0`] : [];

  return {
    kind: 'bothSides',
    op,
    operand,
    text: baseText,
    ...(assumptions.length ? { assumptions } : {}),
  };
};

/**
 * Describe an in-place reduction (simplify / distribute / identity / evaluate /
 * quadratic) as a rewrite. `eq` is the equation the option was derived from, so
 * we can show the before → after of the affected sub-expression.
 */
export const describeReduction = (eq: Equation, option: ReductionOption): StepChange => {
  if (option.label && option.label.includes('Quadratic Formula')) {
    return { kind: 'rewrite', op: 'quadratic', detail: option.label, text: 'apply the quadratic formula' };
  }
  if (option.type === 'distribute') {
    return { kind: 'rewrite', op: 'distribute', text: 'distribute' };
  }
  if (option.type === 'identity') {
    const label = option.label ?? 'apply identity';
    let before = '';
    let afterNode: math.MathNode | null = null;
    try {
      before = nodeToString(getNodeByPath(eq, option.path));
      afterNode = getNodeByPath(option.simplified, option.path);
    } catch {
      /* ignore and fall back to generic */
    }
    const after = nodeToString(afterNode);

    if (before && after) {
      const lowerLabel = label.toLowerCase();
      if (lowerLabel.startsWith('factor out ')) {
        const term = label.slice(11);
        return {
          kind: 'rewrite',
          op: 'identity',
          detail: label,
          text: `factor out ${term} from ${before} → ${after}`,
        };
      }
      if (lowerLabel === 'factor') {
        return {
          kind: 'rewrite',
          op: 'identity',
          detail: label,
          text: `factor ${before} → ${after}`,
        };
      }
      if (lowerLabel.startsWith('factor ')) {
        const factorType = label.slice(7).toLowerCase();
        return {
          kind: 'rewrite',
          op: 'identity',
          detail: label,
          text: `factor ${factorType}: ${before} → ${after}`,
        };
      }
      if (lowerLabel.startsWith('express as ')) {
        const powerType = label.slice(11).toLowerCase();
        return {
          kind: 'rewrite',
          op: 'identity',
          detail: label,
          text: `express ${before} as ${powerType}: ${after}`,
        };
      }
      if (lowerLabel === 'expand power') {
        return {
          kind: 'rewrite',
          op: 'identity',
          detail: label,
          text: `expand power ${before} → ${after}`,
        };
      }
      return {
        kind: 'rewrite',
        op: 'identity',
        detail: label,
        text: `apply ${lowerLabel}: ${before} → ${after}`,
      };
    }

    return { kind: 'rewrite', op: 'identity', detail: option.label, text: label.toLowerCase() };
  }

  // type === 'reduce'
  // Describe from the minimal changed sub-expression, not the raw option path:
  // single removals / cancellations are tagged at the removed leaf, so a naive
  // before→after there reads nonsensically once the tree reshapes (#59).
  const effPath = findMinimalChangedPath(eq, option.simplified, option.path);
  let beforeNode: math.MathNode | null = null;
  let afterNode: math.MathNode | null = null;
  try {
    beforeNode = getNodeByPath(eq, effPath);
    afterNode = getNodeByPath(option.simplified, effPath);
  } catch {
    /* fall through to generic simplify */
  }
  const before = nodeToString(beforeNode);
  const after = nodeToString(afterNode);
  const assumptions = domainRestrictionsForReduction(eq, option);
  // A genuine "evaluate" folds a *constant* subtree to its value. A variable
  // collapsing to a constant (e.g. x cancelling to 1) is NOT an evaluation —
  // it's a cancellation — so require the source to be constant before labelling
  // it evaluate, otherwise we'd assert a falsehood like "evaluate x = 1" (#63).
  const isEvaluate =
    !!afterNode && afterNode.type === 'ConstantNode' && !!beforeNode && isConstantSubtree(beforeNode);
  if (isEvaluate) {
    return { kind: 'rewrite', op: 'evaluate', detail: `${before} = ${after}`, text: `evaluate ${before} = ${after}` };
  }
  // Mirror the evaluate form so simplify steps also show what changed (rewrite
  // arrow `→`, vs `=` for a true numeric equality). Any ≠0 assumption (#63) is
  // carried structurally in `assumptions` so the UI can flag it prominently
  // rather than letting it hide in prose.
  return {
    kind: 'rewrite',
    op: 'simplify',
    detail: before && after ? `${before} → ${after}` : undefined,
    text: before && after ? `simplify ${before} → ${after}` : 'simplify',
    ...(assumptions.length ? { assumptions } : {}),
  };
};

/**
 * Describe a substitution (#3): one occurrence of `variable` replaced by its
 * definition from another equation. `replacement` is a strictly parsable
 * symbolic string (same contract as bothSides operands), so the UI can render
 * it formally; the history node carrying this change records the dependency on
 * the source fact.
 */
export const describeSubstitution = (variable: string, replacement: string): StepChange => ({
  kind: 'rewrite',
  op: 'substitute',
  detail: `${variable} → ${replacement}`,
  text: `substitute ${variable} = ${replacement}`,
});

/**
 * Describe a reverse substitution (collapse, #51): a sub-expression collapsed
 * to its defined variable. `expression` is the sub-expression being replaced,
 * and `variable` is the variable replacing it.
 */
export const describeCollapse = (expression: string, variable: string): StepChange => ({
  kind: 'rewrite',
  op: 'substitute',
  detail: `${expression} → ${variable}`,
  text: `collapse ${expression} to ${variable}`,
});

/**
 * Describe a global op (the both-sides radial-menu operations) as a `bothSides`
 * StepChange. The structured `GlobalOpParams` already carry everything, so this
 * is a pure mapping — no AST inference (unlike transposition). Throws if a
 * binary op arrives without a term (mirrors `applyGlobalOp`).
 */
export const describeGlobalOp = (params: GlobalOpParams): StepChange => {
  const { type, term, power } = params;
  const p = power ?? 2;

  if (type === 'square' || type === 'power') {
    const text = p === 2 ? 'square both sides' : p === 3 ? 'cube both sides' : `raise both sides to the power of ${p}`;
    return { kind: 'bothSides', op: 'power', operand: String(p), text };
  }

  if (type === 'sqrt' || type === 'root') {
    const text =
      p === 2 ? 'take the square root of both sides'
        : p === 3 ? 'take the cube root of both sides'
          : `take the ${p}th root of both sides`;
    return { kind: 'bothSides', op: 'root', operand: String(p), text };
  }

  if (!term || !term.trim()) {
    throw new Error('A term is required to describe this global op.');
  }
  const operand = term.trim();
  switch (type) {
    case 'add':
      return { kind: 'bothSides', op: 'add', operand, text: `add ${operand} to both sides` };
    case 'sub':
      return { kind: 'bothSides', op: 'subtract', operand, text: `subtract ${operand} from both sides` };
    case 'mul':
      return { kind: 'bothSides', op: 'multiply', operand, text: `multiply both sides by ${operand}` };
    default: {
      // 'div' — dividing both sides by a variable expression assumes it ≠ 0 (#63).
      let isVariableDivisor = false;
      try {
        isVariableDivisor = !isConstantSubtree(math.parse(operand));
      } catch {
        /* unparseable operand → no assumption */
      }
      const assumptions = isVariableDivisor ? [`${operand} ≠ 0`] : [];
      return {
        kind: 'bothSides',
        op: 'divide',
        operand,
        text: `divide both sides by ${operand}`,
        ...(assumptions.length ? { assumptions } : {}),
      };
    }
  }
};
