import * as math from 'mathjs';
import { Equation, RelationOperator, flipRelation } from './tree';

export type GlobalOpType =
  | 'square'
  | 'sqrt'
  | 'add'
  | 'sub'
  | 'mul'
  | 'div'
  | 'power'
  | 'root';

export interface GlobalOpParams {
  readonly type: GlobalOpType;
  /** Operand for the binary ops (add/sub/mul/div), e.g. "5" or "2*x". */
  readonly term?: string;
  /** Exponent / root index for square/power/sqrt/root (defaults to 2). */
  readonly power?: number;
}

const BINARY_OPS = {
  add: ['+', 'add'],
  sub: ['-', 'subtract'],
  mul: ['*', 'multiply'],
  div: ['/', 'divide'],
} as const;

/**
 * Apply an operation to BOTH sides of an equation — the "global ops" exposed via
 * the radial menu (square, root, and +/-/×/÷ by a term).
 *
 * Pure and deterministic: returns a new Equation; the caller orchestrates history
 * and labels. Each side is built with its own operand subtree (no shared node
 * references) so later id assignment / mutation stays side-local. Throws if a
 * binary op is requested without a term.
 */
/**
 * Evaluates a parsed operand to a finite number, or returns null when it is not
 * a pure constant (e.g. contains a variable). Used to detect multiplying or
 * dividing an inequality by a negative constant, which flips the relation.
 */
const constantValue = (node: math.MathNode): number | null => {
  try {
    const val = Number((node as unknown as { evaluate: () => unknown }).evaluate());
    return Number.isFinite(val) ? val : null;
  } catch {
    return null;
  }
};

export const applyGlobalOp = (eq: Equation, params: GlobalOpParams): Equation => {
  const { type, term, power } = params;
  const effectivePower = power ?? 2;
  const relation = eq.relation;

  if (type === 'square' || type === 'power') {
    return {
      lhs: new math.OperatorNode('^', 'pow', [eq.lhs, new math.ConstantNode(effectivePower)]),
      rhs: new math.OperatorNode('^', 'pow', [eq.rhs, new math.ConstantNode(effectivePower)]),
      relation,
    };
  }

  if (type === 'sqrt' || type === 'root') {
    if (effectivePower === 2) {
      return {
        lhs: new math.FunctionNode('sqrt', [eq.lhs]),
        rhs: new math.FunctionNode('sqrt', [eq.rhs]),
        relation,
      };
    }
    return {
      lhs: new math.FunctionNode('nthRoot', [eq.lhs, new math.ConstantNode(effectivePower)]),
      rhs: new math.FunctionNode('nthRoot', [eq.rhs, new math.ConstantNode(effectivePower)]),
      relation,
    };
  }

  if (!term || !term.trim()) {
    throw new Error('Please specify a term to apply to both sides (e.g. 5x).');
  }
  const binary = BINARY_OPS[type as 'add' | 'sub' | 'mul' | 'div'];
  if (!binary) {
    throw new Error(`Unknown global op type: ${type}`);
  }
  const [opSym, opName] = binary;

  // Multiplying/dividing both sides of an inequality by a negative constant
  // reverses its direction (e.g. `-2 * x < 6` -> `x > -3`). Addition,
  // subtraction, and equalities are never flipped.
  let newRelation: RelationOperator | undefined = relation;
  if (relation && relation !== '=' && (type === 'mul' || type === 'div')) {
    const operandValue = constantValue(math.parse(term.trim()));
    if (operandValue !== null && operandValue < 0) {
      newRelation = flipRelation(relation);
    }
  }

  return {
    lhs: new math.OperatorNode(opSym, opName, [eq.lhs, math.parse(term.trim())]),
    rhs: new math.OperatorNode(opSym, opName, [eq.rhs, math.parse(term.trim())]),
    relation: newRelation,
  };
};
