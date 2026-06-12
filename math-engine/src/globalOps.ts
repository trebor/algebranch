import * as math from 'mathjs';
import { Equation } from './tree';

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
export const applyGlobalOp = (eq: Equation, params: GlobalOpParams): Equation => {
  const { type, term, power } = params;
  const effectivePower = power ?? 2;

  if (type === 'square' || type === 'power') {
    return {
      lhs: new math.OperatorNode('^', 'pow', [eq.lhs, new math.ConstantNode(effectivePower)]),
      rhs: new math.OperatorNode('^', 'pow', [eq.rhs, new math.ConstantNode(effectivePower)]),
    };
  }

  if (type === 'sqrt' || type === 'root') {
    if (effectivePower === 2) {
      return {
        lhs: new math.FunctionNode('sqrt', [eq.lhs]),
        rhs: new math.FunctionNode('sqrt', [eq.rhs]),
      };
    }
    return {
      lhs: new math.FunctionNode('nthRoot', [eq.lhs, new math.ConstantNode(effectivePower)]),
      rhs: new math.FunctionNode('nthRoot', [eq.rhs, new math.ConstantNode(effectivePower)]),
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
  return {
    lhs: new math.OperatorNode(opSym, opName, [eq.lhs, math.parse(term.trim())]),
    rhs: new math.OperatorNode(opSym, opName, [eq.rhs, math.parse(term.trim())]),
  };
};
