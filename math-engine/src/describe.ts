import * as math from 'mathjs';
import { Equation, getNodeByPath } from './tree';
import { ReductionOption } from './simplify';

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
      readonly op: 'add' | 'subtract' | 'multiply' | 'divide';
      readonly operand: string;
      readonly text: string;
    }
  | {
      readonly kind: 'rewrite';
      readonly op: 'evaluate' | 'simplify' | 'distribute' | 'identity' | 'quadratic';
      readonly detail?: string;
      readonly text: string;
    };

const nodeToString = (node: math.MathNode | null): string => (node ? node.toString() : '');

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

  const text =
    op === 'subtract'
      ? `subtract ${operand} from both sides`
      : op === 'add'
        ? `add ${operand} to both sides`
        : op === 'multiply'
          ? `multiply both sides by ${operand}`
          : `divide both sides by ${operand}`;

  return { kind: 'bothSides', op, operand, text };
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
    return { kind: 'rewrite', op: 'identity', detail: option.label, text: label.toLowerCase() };
  }

  // type === 'reduce'
  let before = '';
  let afterNode: math.MathNode | null = null;
  try {
    before = nodeToString(getNodeByPath(eq, option.path));
    afterNode = getNodeByPath(option.simplified, option.path);
  } catch {
    /* fall through to generic simplify */
  }
  const after = nodeToString(afterNode);
  const isEvaluate = !!afterNode && afterNode.type === 'ConstantNode' && !!before;
  if (isEvaluate) {
    return { kind: 'rewrite', op: 'evaluate', detail: `${before} = ${after}`, text: `evaluate ${before} = ${after}` };
  }
  return {
    kind: 'rewrite',
    op: 'simplify',
    detail: before && after ? `${before} → ${after}` : undefined,
    text: 'simplify',
  };
};
