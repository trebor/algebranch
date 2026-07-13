// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import type * as math from 'mathjs';
import { mjs } from './mathjs';
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
/**
 * The interaction handle a rewrite is offered under — the five-handle taxonomy
 * of #427: Simplify · Expand · Factor · Rewrite(identity) · Substitute. This is
 * the *single source of truth* the history-tree connector badge reads (#103): a
 * reduction is bucketed into its handle stack by `ReductionOption.type`, so the
 * family stamped on the change must be derived from that same `type` — never
 * re-inferred from the finer prose `op` — or the connector badge can drift away
 * from the handle the student actually clicked.
 */
export type HandleFamily = 'simplify' | 'expand' | 'factor' | 'identity' | 'substitute';

/**
 * The family stamped on a rewrite `StepChange` for the connector badge (#103).
 * Either one of the five clicked handles, or `'rearrange'` — a within-a-side
 * drag (#512), which is *not* handle-initiated: like a cross-equals drag it
 * wears a neutral connector glyph, never a themed handle icon (the badge must
 * never claim Simplify/Factor for a drag). Kept distinct from `HandleFamily` so
 * the five-handle taxonomy that `handleFamilyForReductionType` speaks to stays
 * pure.
 */
export type RewriteFamily = HandleFamily | 'rearrange';

/** Map a reduction's engine `type` to the handle family it is offered under. */
export const handleFamilyForReductionType = (type: ReductionOption['type']): HandleFamily =>
  type === 'expand' ? 'expand'
    : type === 'factor' ? 'factor'
      : type === 'identity' ? 'identity'
        : 'simplify'; // 'reduce'

export type StepChange =
  | {
      readonly kind: 'bothSides';
      readonly op: 'add' | 'subtract' | 'multiply' | 'divide' | 'power' | 'root' | 'reciprocal';
      // For add/subtract/multiply/divide: the term. For power/root: the
      // exponent / root index (e.g. '2' = square / square-root). For
      // reciprocal — the compound "take the reciprocal of both sides, then
      // multiply by N" a fraction-numerator drag performs (#491), net effect
      // s ↦ N/s — the numerator N. Always a strictly parsable symbolic string.
      readonly operand: string;
      readonly text: string;
      // Domain restrictions the step relies on, e.g. ['x ≠ 0'] when dividing
      // both sides by a variable expression (#63). Omitted when there are none.
      readonly assumptions?: readonly string[];
    }
  | {
      readonly kind: 'rewrite';
      // The handle this rewrite was offered under — what the connector badge
      // renders (#103). Required, so every rewrite must declare its family and
      // the badge can never diverge from the handle. `'rearrange'` marks a
      // within-a-side drag (#512), which draws a neutral glyph, not a handle.
      readonly family: RewriteFamily;
      // The finer prose classification, used for the step's wording (not the
      // badge). #427 split the product↔sum inverse pair out of the old buckets —
      // 'expand' (distribute) and 'factor'. Power-unfolding briefly rode 'expand'
      // too but rejoined 'identity' in #466. 'distribute' lingers only so history
      // nodes serialized before #427 still parse.
      readonly op: 'evaluate' | 'simplify' | 'expand' | 'factor' | 'distribute' | 'identity' | 'quadratic' | 'quadratic_standard_form' | 'substitute' | 'rearrange';
      // The parseable before → after of the affected sub-expression (`a → b`),
      // rendered as pretty math by the transition tooltip. Uniform across every
      // in-place rewrite so the tooltip body never has to special-case a family.
      readonly detail?: string;
      // The concise operation name for compact UIs — the transition tooltip's
      // title (e.g. "Factor", "Distribute", "Rationalize Denominator"). The full
      // accessible sentence, with the before → after spelled out, lives in `text`.
      readonly label?: string;
      readonly text: string;
      // Domain restrictions the step relies on, e.g. ['x ≠ 0'] when a variable
      // factor is cancelled out of a fraction (#63). Omitted when there are none.
      readonly assumptions?: readonly string[];
    };

/** A rewrite `StepChange` before its handle family is stamped on. */
type RewriteBody = Omit<Extract<StepChange, { kind: 'rewrite' }>, 'family'>;

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
  // The equation the move search actually selected for this destination. When
  // provided, the label + `≠ 0` restriction are reconciled against it: the move
  // search can pick a different orientation than the naive structural inverse
  // predicts (e.g. dragging a fraction numerator across `=` collapses the
  // fraction and reattaches the term reciprocally), and the honest description
  // must follow the equation the student will actually see (#491).
  resultEq?: Equation,
): StepChange | null => {
  const srcSide = sourcePath.split('/')[0];
  const tgtSide = targetPath.split('/')[0];
  if (srcSide !== 'lhs' && srcSide !== 'rhs') return null;
  // Only a cross-equals move is a clean both-sides operation.
  if (srcSide === tgtSide) return null;

  const parts = sourcePath.split('/');
  if (parts.length < 2) {
    let moved: math.MathNode;
    try {
      moved = getNodeByPath(eq, sourcePath);
    } catch {
      return null;
    }
    const operand = nodeToString(moved);
    const op = 'subtract';
    const baseText = `subtract ${operand} from both sides`;
    return {
      kind: 'bothSides',
      op,
      operand,
      text: baseText,
    };
  }

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
  let op: 'add' | 'subtract' | 'multiply' | 'divide' | 'reciprocal' | null = null;
  switch (parentOp) {
    case '+':
      op = 'subtract';
      break;
    case '-':
      // Right child (subtrahend, a negative term) → add it to both sides. Left
      // child (minuend, a positive leading term — e.g. the head of `a - b - c`)
      // → subtract it from both sides (#354).
      op = childIndex === 1 ? 'add' : 'subtract';
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

  // Reconcile a fraction-numerator drag against the result the move search
  // actually chose (#491). Dragging the numerator `b` of a whole-side fraction
  // `b/x` across `=` removes `b`, collapsing `b/x` down to its denominator `x`;
  // the only equivalent reattachment is the reverse-division `b/a` (with `a` the
  // opposite side), giving `b/a = x`. No single ×/÷ applied to both sides
  // produces that line — the naive inverse above ("b is a numerator → divide by
  // b, b ≠ 0") is simply false of it. The honest description is the compound
  // reciprocal move, take the reciprocal of both sides then multiply by b (net
  // effect: each side s ↦ b/s), whose restriction is the result's real
  // denominator: the far side ≠ 0. Detect exactly that orientation — the
  // result's target side is `moved / oppositeSide` — and record it as a
  // 'reciprocal' step; every other move keeps the structural inverse untouched.
  // `restrictedNode` is the expression the step's `≠ 0` assumption guards: the
  // divisor for a plain divide, the new denominator for a reciprocal move.
  let restrictedNode: math.MathNode | null = op === 'divide' ? moved : null;
  if (resultEq && parentOp === '/' && childIndex === 0) {
    try {
      const oppositeSide = getNodeByPath(eq, tgtSide);
      const resultTarget = getNodeByPath(resultEq, tgtSide);
      const reciprocal = new mjs.OperatorNode('/', 'divide', [moved, oppositeSide]);
      if (cleanStr(nodeToString(resultTarget)) === cleanStr(nodeToString(reciprocal))) {
        op = 'reciprocal';
        restrictedNode = oppositeSide;
      }
    } catch {
      /* result shape doesn't match; keep the structural inverse */
    }
  }

  const baseText =
    op === 'subtract'
      ? `subtract ${operand} from both sides`
      : op === 'add'
        ? `add ${operand} to both sides`
        : op === 'multiply'
          ? `multiply both sides by ${operand}`
          : op === 'reciprocal'
            ? `take the reciprocal of both sides, then multiply by ${operand}`
            : `divide both sides by ${operand}`;

  // A step that lands a variable expression in a denominator assumes it is
  // non-zero (#63): the divisor when dividing both sides, the far side when a
  // reciprocal move flips it under the moved numerator (#491).
  const assumptions =
    restrictedNode && !isConstantSubtree(restrictedNode)
      ? [`${nodeToString(restrictedNode)} ≠ 0`]
      : [];

  return {
    kind: 'bothSides',
    op,
    operand,
    text: baseText,
    ...(assumptions.length ? { assumptions } : {}),
  };
};

/**
 * Describe a within-a-side move (#512) — a term dragged to another spot on the
 * *same* side of `=`. `describeTransposition` deliberately returns null for
 * these (they are not a clean both-sides op), which used to leave them with the
 * coarse "Move" fallback that tells the learner nothing. Here we describe the
 * rearrangement the same way a reduction is: as a rewrite of the minimal changed
 * sub-expression, `before → after`. `resultEq` is the equation the move search
 * actually produced. Returns null for a no-op (identical result) or a malformed
 * source path — the caller can fall back to the coarse label.
 */
export const describeSameSideMove = (
  eq: Equation,
  resultEq: Equation,
  sourcePath: string,
): StepChange | null => {
  const side = sourcePath.split('/')[0];
  if (side !== 'lhs' && side !== 'rhs') return null;
  // A move that changes nothing describes nothing.
  if (`${eq.lhs.toString()} = ${eq.rhs.toString()}` === `${resultEq.lhs.toString()} = ${resultEq.rhs.toString()}`) {
    return null;
  }
  // Recover the smallest sub-expression that fully contains the change (a
  // regroup often reshapes more than the dragged leaf), then show its before →
  // after — exactly the machinery the decomposed simplify steps use (#59).
  const path = findMinimalChangedPath(eq, resultEq, sourcePath);
  let beforeNode: math.MathNode;
  let afterNode: math.MathNode;
  try {
    beforeNode = getNodeByPath(eq, path);
    afterNode = getNodeByPath(resultEq, path);
  } catch {
    return null;
  }
  const before = nodeToString(beforeNode);
  const after = nodeToString(afterNode);
  if (!before || !after || before === after) return null;
  return {
    kind: 'rewrite',
    // A drag, not a clicked handle: the badge stays a neutral connector glyph.
    family: 'rearrange',
    op: 'rearrange',
    detail: `${before} → ${after}`,
    label: 'Rearrange',
    text: `rearrange ${before} into ${after}`,
  };
};

/**
 * The single entry point for describing a drag-move (#512): a cross-equals move
 * is a clean both-sides operation (`describeTransposition`), a within-a-side
 * move is a rearrangement (`describeSameSideMove`). The caller passes both paths
 * plus the equation the move search selected, and gets one honest description
 * back — or null for shapes we don't describe precisely.
 */
export const describeMove = (
  eq: Equation,
  sourcePath: string,
  targetPath: string,
  resultEq: Equation,
): StepChange | null => {
  const srcSide = sourcePath.split('/')[0];
  const tgtSide = targetPath.split('/')[0];
  return srcSide === tgtSide
    ? describeSameSideMove(eq, resultEq, sourcePath)
    : describeTransposition(eq, sourcePath, targetPath, resultEq);
};

/**
 * Describe an in-place reduction (simplify / distribute / identity / evaluate /
 * quadratic) as a rewrite. `eq` is the equation the option was derived from, so
 * we can show the before → after of the affected sub-expression.
 */
export const describeReduction = (eq: Equation, option: ReductionOption): StepChange => ({
  ...describeReductionBody(eq, option),
  // The concise operation name for the tooltip title is the handle label the
  // student clicked — spread last so it authoritatively wins over any label a
  // body might carry, mirroring how `family` follows the handle below.
  ...(option.label ? { label: option.label } : {}),
  // The badge follows the handle, always: family comes from the option's type,
  // the same thing that placed it in a handle stack — never from `op` below.
  family: handleFamilyForReductionType(option.type),
});

const describeReductionBody = (eq: Equation, option: ReductionOption): RewriteBody => {
  // #90: the =0 normalization step that precedes the quadratic formula.
  if (option.label === 'Write in Standard Form') {
    return { kind: 'rewrite', op: 'quadratic_standard_form', detail: option.label, text: 'write in standard form (= 0)' };
  }
  if (option.label && option.label.includes('Quadratic Formula')) {
    return { kind: 'rewrite', op: 'quadratic', detail: option.label, text: 'apply the quadratic formula' };
  }
  // Distribution rides the Expand handle (#427), so its StepChange op is
  // 'expand' while the prose stays "distribute". It is the sole Expand member
  // now that unfolding a power moved to Rewrite (#466), so keying off the label
  // is belt-and-suspenders.
  if (option.type === 'expand' && option.label === 'Distribute') {
    // Name what is being distributed by showing the affected sub-expression's
    // before → after, parallel to the other reductions below — a bare
    // "distribute" leaves the student guessing which product was expanded.
    let before = '';
    let after = '';
    try {
      before = nodeToString(getNodeByPath(eq, option.path));
      after = nodeToString(getNodeByPath(option.simplified, option.path));
    } catch {
      /* fall back to a bare label */
    }
    return {
      kind: 'rewrite',
      op: 'expand',
      detail: before && after ? `${before} → ${after}` : undefined,
      text: before && after ? `distribute ${before} → ${after}` : 'distribute',
    };
  }
  // Combining fractions over a common denominator (#61) is a 'reduce' option, but
  // gets its own phrasing and carries the b·d ≠ 0 domain assumption (#63).
  if (option.label === 'Combine Fractions') {
    let before = '';
    let after = '';
    try {
      before = nodeToString(getNodeByPath(eq, option.path));
      after = nodeToString(getNodeByPath(option.simplified, option.path));
    } catch {
      /* fall back to a bare label */
    }
    const assumptions = domainRestrictionsForReduction(eq, option);
    return {
      kind: 'rewrite',
      op: 'simplify',
      detail: before && after ? `${before} → ${after}` : undefined,
      text: before && after ? `combine fractions ${before} → ${after}` : 'combine fractions',
      ...(assumptions.length ? { assumptions } : {}),
    };
  }
  // Combining like radicals (#66) reads better with its own verb than the
  // generic "simplify a → b" while still showing the before → after.
  if (option.label === 'Combine Like Radicals') {
    let before = '';
    let after = '';
    try {
      before = nodeToString(getNodeByPath(eq, option.path));
      after = nodeToString(getNodeByPath(option.simplified, option.path));
    } catch {
      /* fall back to a bare label */
    }
    return {
      kind: 'rewrite',
      op: 'simplify',
      detail: before && after ? `${before} → ${after}` : undefined,
      text: before && after ? `combine like radicals ${before} → ${after}` : 'combine like radicals',
    };
  }
  // Rationalizing a radical denominator (#66) reads better with its own verb than
  // the generic "simplify a → b" while still showing the before → after.
  if (option.label === 'Rationalize Denominator') {
    let before = '';
    let after = '';
    try {
      before = nodeToString(getNodeByPath(eq, option.path));
      after = nodeToString(getNodeByPath(option.simplified, option.path));
    } catch {
      /* fall back to a bare label */
    }
    return {
      kind: 'rewrite',
      op: 'simplify',
      detail: before && after ? `${before} → ${after}` : undefined,
      text: before && after ? `rationalize denominator ${before} → ${after}` : 'rationalize denominator',
    };
  }
  // Completing the square (#62) reads better with its own verb than the generic
  // "apply complete the square" while still showing the before → after.
  if (option.label === 'Complete the Square') {
    let before = '';
    let after = '';
    try {
      before = nodeToString(getNodeByPath(eq, option.path));
      after = nodeToString(getNodeByPath(option.simplified, option.path));
    } catch {
      /* fall back to a bare label */
    }
    return {
      kind: 'rewrite',
      op: 'identity',
      detail: before && after ? `${before} → ${after}` : option.label,
      text: before && after ? `complete the square ${before} → ${after}` : 'complete the square',
    };
  }
  // The Rewrite (identity) family plus Factor — the structural move split out of
  // it in #427 — all describe from their label here. The 'expand' arm is now
  // vestigial: Distribute returns above and power-unfolding rejoined identity in
  // #466, so no 'expand' currently reaches here, but the guard stays defensive.
  if (option.type === 'identity' || option.type === 'factor' || option.type === 'expand') {
    const label = option.label ?? 'apply identity';
    // The history-tree edge badge (#103) mirrors the handle the student clicked,
    // so carry the split-out handle family through as the StepChange op (#427):
    // Factor / Expand get their own, everything else stays the Rewrite identity.
    const familyOp = option.type === 'factor' ? 'factor' : option.type === 'expand' ? 'expand' : 'identity';
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
          op: familyOp,
          detail: `${before} → ${after}`,
          text: `factor out ${term} from ${before} → ${after}`,
        };
      }
      if (lowerLabel === 'factor') {
        return {
          kind: 'rewrite',
          op: familyOp,
          detail: `${before} → ${after}`,
          text: `factor ${before} → ${after}`,
        };
      }
      if (lowerLabel.startsWith('factor ')) {
        const factorType = label.slice(7).toLowerCase();
        return {
          kind: 'rewrite',
          op: familyOp,
          detail: `${before} → ${after}`,
          text: `factor ${factorType}: ${before} → ${after}`,
        };
      }
      if (lowerLabel.startsWith('express as ')) {
        const powerType = label.slice(11).toLowerCase();
        return {
          kind: 'rewrite',
          op: familyOp,
          detail: `${before} → ${after}`,
          text: `express ${before} as ${powerType}: ${after}`,
        };
      }
      return {
        kind: 'rewrite',
        op: familyOp,
        detail: `${before} → ${after}`,
        text: `apply ${lowerLabel}: ${before} → ${after}`,
      };
    }

    // No before/after resolved — there is no math to typeset, so omit `detail`
    // (the concise `label` still titles the tooltip via describeReduction).
    return { kind: 'rewrite', op: familyOp, text: label.toLowerCase() };
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
  family: 'substitute',
  op: 'substitute',
  label: 'Substitute',
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
  family: 'substitute',
  op: 'substitute',
  label: 'Collapse',
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
        isVariableDivisor = !isConstantSubtree(mjs.parse(operand));
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
