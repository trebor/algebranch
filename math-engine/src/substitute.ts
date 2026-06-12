import * as math from 'mathjs';
import { Equation, getChildren, replaceNodeAtPath, ensureNodeIds } from './tree';
import { getVariables } from './validator';

/**
 * A usable definition of a variable, typically harvested from another
 * workspace whose current equation has the variable isolated (#3).
 */
export interface SubstitutionFact {
  readonly variable: string;
  readonly expression: math.MathNode;
  /** Optional provenance (e.g. source workspace tab) for UI labels. */
  readonly sourceId?: string;
  readonly sourceName?: string;
}

export interface SubstitutionOption {
  readonly path: string;
  readonly substituted: Equation;
  readonly variable: string;
  /** The replacement expression as a strictly parsable symbolic string. */
  readonly replacement: string;
  readonly fact: SubstitutionFact;
}

const unwrapParens = (n: math.MathNode): math.MathNode => {
  while (n.type === 'ParenthesisNode') {
    n = (n as math.ParenthesisNode).content;
  }
  return n;
};

/**
 * Returns the isolated definition an equation provides, if any: one side must be
 * a bare variable (pi/e excluded) that does NOT occur on the other side
 * (`y = y + 1` defines nothing). The other side is the defining expression.
 */
export const getIsolatedDefinition = (
  eq: Equation,
): { variable: string; expression: math.MathNode } | null => {
  const isBareVar = (n: math.MathNode): n is math.SymbolNode => {
    if (n.type !== 'SymbolNode') return false;
    const name = (n as math.SymbolNode).name;
    return name !== 'pi' && name !== 'e';
  };

  const lhs = unwrapParens(eq.lhs);
  if (isBareVar(lhs) && !getVariables(eq.rhs).includes(lhs.name)) {
    return { variable: lhs.name, expression: eq.rhs };
  }
  const rhs = unwrapParens(eq.rhs);
  if (isBareVar(rhs) && !getVariables(eq.lhs).includes(rhs.name)) {
    return { variable: rhs.name, expression: eq.lhs };
  }
  return null;
};

/**
 * Forward substitution (#3, Phase 1): for each fact `y = expr`, every occurrence
 * of `y` in the equation yields an option replacing that one occurrence with
 * `(expr)` — parenthesized when the replacement is an operator expression so
 * precedence is preserved. Options are grouped by node path; multiple facts for
 * the same variable produce multiple options on the same node (like the
 * quadratic ± branches).
 *
 * Pure and synchronous — intended to run client-side via the unified engine
 * (#44), no API round-trip.
 */
export const getSubstitutionOptions = (
  eq: Equation,
  facts: readonly SubstitutionFact[],
): Record<string, SubstitutionOption[]> => {
  const result: Record<string, SubstitutionOption[]> = {};

  const collectVarPaths = (node: math.MathNode, prefix: string, name: string, hits: string[]) => {
    if (node.type === 'SymbolNode' && (node as math.SymbolNode).name === name) {
      hits.push(prefix);
    }
    getChildren(node).forEach((child, i) => collectVarPaths(child, `${prefix}/${i}`, name, hits));
  };

  for (const fact of facts) {
    if (!fact?.variable || !fact.expression) continue;

    const hits: string[] = [];
    collectVarPaths(eq.lhs, 'lhs', fact.variable, hits);
    collectVarPaths(eq.rhs, 'rhs', fact.variable, hits);

    for (const path of hits) {
      try {
        const cloned = fact.expression.cloneDeep();
        const replacementNode =
          cloned.type === 'OperatorNode' ? new math.ParenthesisNode(cloned) : cloned;
        const substituted = ensureNodeIds(replaceNodeAtPath(eq, path, replacementNode));
        (result[path] ||= []).push({
          path,
          substituted,
          variable: fact.variable,
          replacement: fact.expression.toString(),
          fact,
        });
      } catch {
        // Path failed to resolve/replace — skip this occurrence.
        continue;
      }
    }
  }

  return result;
};
