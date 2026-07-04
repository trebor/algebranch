// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import React from 'react';
import { useAtomValue } from 'jotai';
import type * as math from 'mathjs';
import { currentEquationAtom } from '../store/equation';
import { Equation, getNodeByPath, getFunctionName, formatNumber, isCommutativeChainLink } from 'math-engine-client';
import { OPERATOR_DISPLAY, splitSubscript, isImaginaryUnit } from '../constants/mathSymbols';
import { THEME_GLASS } from '../constants/theme';
import { useEquationPreviewPalette } from './EquationPreviewPaletteContext';
import { useOptionalRovingTabindex } from '../hooks/useRovingTabindex';
import {
  hasTallRootIndex,
  radicalPath,
  RADICAL_DEFAULT_CROOK_Y,
  RADICAL_CROOK_FRACTION,
  INDEX_INSET_EM,
  RADICAL_SVG_WIDTH_EM,
} from './radicalGeometry';

/**
 * Exploration mode (#270): when present, the otherwise read-only preview renderer
 * becomes a focusable, hierarchically-navigable `role="tree"` for reading the
 * equation's structure by ear. Each node turns into a `treeitem` labelled as spoken
 * math; arrow keys drill the AST (see ExploreEquationTree). `onExit` is invoked on
 * Escape to leave the mode. Absent (the default), the preview stays inert — exactly
 * its tooltip/menu behaviour.
 */
interface ExploreContextValue {
  readonly active: boolean;
  readonly onExit?: () => void;
}
export const ExploreContext = React.createContext<ExploreContextValue>({ active: false });

const LeftParenSVG: React.FC<{ className?: string; style?: React.CSSProperties }> = ({ className, style }) => (
  <svg
    viewBox="0 0 8 100"
    preserveAspectRatio="none"
    className={className}
    style={style}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
  >
    <path
      d="M 6,3 C 1,25 1,75 6,97"
      vectorEffect="non-scaling-stroke"
      strokeLinecap="round"
    />
  </svg>
);

const RightParenSVG: React.FC<{ className?: string; style?: React.CSSProperties }> = ({ className, style }) => (
  <svg
    viewBox="0 0 8 100"
    preserveAspectRatio="none"
    className={className}
    style={style}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
  >
    <path
      d="M 2,3 C 7,25 7,75 2,97"
      vectorEffect="non-scaling-stroke"
      strokeLinecap="round"
    />
  </svg>
);

interface PreviewEquationNodeProps {
  readonly path?: string;
  readonly inExponent?: boolean;
  readonly customEquation?: Equation;
  readonly customNode?: math.MathNode;
}

export const PreviewEquationNode: React.FC<PreviewEquationNodeProps> = ({
  path,
  inExponent = false,
  customEquation,
  customNode,
}) => {
  const currentEq = useAtomValue(currentEquationAtom);
  const eq = customEquation ?? currentEq;
  const roving = useOptionalRovingTabindex();
  const explore = React.useContext(ExploreContext);
  // Leaf glyph colours, swapped to a light palette by the image-export container
  // when rendering on a white/transparent background (#335). Defaults to dark.
  const palette = useEquationPreviewPalette();

  const node = React.useMemo(() => {
    if (customNode) return customNode;
    if (!path) return null;
    try {
      return getNodeByPath(eq, path);
    } catch {
      return null;
    }
  }, [customNode, eq, path]);

  // A node is an exploration stop (#270) when the explore tree is active and we have
  // a live path to key it by. Parentheses stay transparent — drilling skips straight
  // to their content, so a listener never hits a redundant "the quantity" stop.
  // An arbitrary same-operator link in an associative chain (the inner `+` of
  // `a+b+c` = `+[+[a,b],c]`) is likewise skipped, so a flat chain reads as a run of
  // siblings under one "sum"/"product" rather than surfacing the parser's nesting
  // as a synthetic middle stop (#290). The chain-link test needs the immediate
  // parent, which is the node one path segment up.
  const parentNode = React.useMemo(() => {
    if (!path) return null;
    const slash = path.lastIndexOf('/');
    if (slash < 0) return null; // a side root (lhs/rhs) has no parent
    try {
      return getNodeByPath(eq, path.slice(0, slash));
    } catch {
      return null;
    }
  }, [eq, path]);
  const isStop =
    explore.active &&
    !!roving &&
    !!path &&
    !!node &&
    node.type !== 'ParenthesisNode' &&
    !isCommutativeChainLink(node, parentNode);

  const registerExploreItem = React.useCallback(
    (el: HTMLElement | null) => {
      if (!roving || !isStop || !path) return;
      if (el) roving.registerItem(path, el);
      else roving.unregisterItem(path);
    },
    [roving, isStop, path],
  );

  // Tall root-index placement (#356), ported from the live renderer (#201). A
  // fraction/nested-radical index is seated crook-relative: its content is absolutely
  // positioned so its bottom rides the crook line, and the column reserves the measured
  // footprint (minWidth/minHeight) so the node box still wraps it (#198) and the row
  // grows tall enough to hold it. The preview has no handles and no auto-scaler, so this
  // is the live renderer's logic minus the handle-band unit-splitting: we measure the
  // absolute wrapper directly (no `[data-eq-node]` padding to subtract) and seat at the
  // plain INDEX_INSET_EM.
  const rootIndexIsTall = hasTallRootIndex(node);
  const crookFraction = rootIndexIsTall ? RADICAL_CROOK_FRACTION : RADICAL_DEFAULT_CROOK_Y / 100;
  const armXAtCrook = 7.5 + (12 - 7.5) * (1 - crookFraction);
  const indexArmGapBaseEm = RADICAL_SVG_WIDTH_EM * (armXAtCrook / 12);
  const indexArmRightMarginEm = INDEX_INSET_EM - indexArmGapBaseEm;

  const indexSlotRef = React.useRef<HTMLDivElement>(null);
  const [indexBox, setIndexBox] = React.useState({ minW: 0, minH: 0 });
  React.useLayoutEffect(() => {
    const col = indexSlotRef.current;
    if (!col) {
      setIndexBox({ minW: 0, minH: 0 });
      return;
    }
    const measure = () => {
      const wrapper = col.firstElementChild as HTMLElement | null;
      const fontSize = parseFloat(getComputedStyle(col).fontSize);
      if (!wrapper || !fontSize) return;
      const exprEm = wrapper.offsetHeight / fontSize;
      const minW = Math.max(0, wrapper.offsetWidth / fontSize + indexArmRightMarginEm);
      const minH = (exprEm + INDEX_INSET_EM) / crookFraction;
      setIndexBox((prev) =>
        Math.abs(prev.minW - minW) > 0.001 || Math.abs(prev.minH - minH) > 0.001
          ? { minW, minH }
          : prev,
      );
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(col.firstElementChild ?? col);
    return () => observer.disconnect();
  }, [crookFraction, indexArmRightMarginEm, node]);

  if (!node) return null;

  const nodeId = (node as unknown as { id?: string })?.id || (path ? `preview_${path}` : undefined);

  // Recursive Render logic depending on Node type
  const renderContent = () => {
    if (node.type === 'ConstantNode') {
      const constNode = node as math.ConstantNode;
      return <span className={`font-semibold ${palette.number}`}>{formatNumber(constNode.value)}</span>;
    }

    if (node.type === 'SymbolNode') {
      const symbolNode = node as math.SymbolNode;
      // Upright roman i for the imaginary unit (ISO-80000-2), matching the live
      // renderer in EquationNode — the constant ⅈ reads distinct from italic
      // variable i, and we draw our own `i` rather than the U+2148 glyph. (#105)
      if (isImaginaryUnit(symbolNode.name)) {
        return <span className={`not-italic font-serif font-medium ${palette.variable}`}>i</span>;
      }
      const { head, sub } = splitSubscript(symbolNode.name);
      return (
        <span className={`italic font-serif font-medium ${palette.variable}`}>
          {head}
          {sub !== null && <sub className={THEME_GLASS.MATH_SUBSCRIPT}>{sub}</sub>}
        </span>
      );
    }

    if (node.type === 'ParenthesisNode') {
      return (
        <div className="flex items-stretch px-[0.05em] relative">
          <div className="relative w-[0.32em] select-none shrink-0">
            <div
              className="absolute inset-x-0"
              style={{
                top: '0.2em',
                bottom: '0.2em'
              }}
            >
              <LeftParenSVG className={`w-full h-full ${palette.paren}`} />
            </div>
          </div>
          <div className="px-[0.05em]">
            <PreviewEquationNode
              path={customNode ? undefined : `${path}/0`}
              customNode={customNode ? (node as math.ParenthesisNode).content : undefined}
              inExponent={inExponent}
              customEquation={customEquation}
            />
          </div>
          <div className="relative w-[0.32em] select-none shrink-0">
            <div
              className="absolute inset-x-0"
              style={{
                top: '0.2em',
                bottom: '0.2em'
              }}
            >
              <RightParenSVG className={`w-full h-full ${palette.paren}`} />
            </div>
          </div>
        </div>
      );
    }

    if (node.type === 'OperatorNode') {
      const opNode = node as math.OperatorNode;

      if (opNode.isUnary()) {
        const opSymbol = opNode.op === '-' ? '−' : opNode.op;
        // Parenthesize a unary-minus operand of a unary minus so it reads "−(−3)"
        // rather than the ambiguous "−−3" (mirrors EquationNode and equationToString).
        const child = opNode.args[0];
        const childNeedsParens =
          opNode.op === '-' &&
          child.type === 'OperatorNode' &&
          (child as math.OperatorNode).isUnary() &&
          (child as math.OperatorNode).op === '-';
        return (
          <div className="flex items-center gap-[0.05em]">
            <span className={`font-bold select-none ${palette.operator}`}>{opSymbol}</span>
            {childNeedsParens ? (
              <div className="flex items-stretch px-[0.05em] relative">
                <div className="relative w-[0.32em] select-none shrink-0">
                  <div
                    className="absolute inset-x-0"
                    style={{
                      top: '0.2em',
                      bottom: '0.2em'
                    }}
                  >
                    <LeftParenSVG className={`w-full h-full ${palette.paren}`} />
                  </div>
                </div>
                <div className="px-[0.05em]">
                  <PreviewEquationNode
                    path={customNode ? undefined : `${path}/0`}
                    customNode={customNode ? (node as math.OperatorNode).args[0] : undefined}
                    inExponent={inExponent}
                    customEquation={customEquation}
                  />
                </div>
                <div className="relative w-[0.32em] select-none shrink-0">
                  <div
                    className="absolute inset-x-0"
                    style={{
                      top: '0.2em',
                      bottom: '0.2em'
                    }}
                  >
                    <RightParenSVG className={`w-full h-full ${palette.paren}`} />
                  </div>
                </div>
              </div>
            ) : (
              <PreviewEquationNode
                path={customNode ? undefined : `${path}/0`}
                customNode={customNode ? (node as math.OperatorNode).args[0] : undefined}
                inExponent={inExponent}
                customEquation={customEquation}
              />
            )}
          </div>
        );
      }

      // Binary Fraction operator (Vertical rendering)
      if (opNode.op === '/') {
        return (
          <div className={`flex flex-col items-center justify-center ${inExponent ? 'mx-[0.05em] my-[0.02em] text-[0.7em] leading-none' : 'mx-[0.1em] my-[0.05em]'}`}>
            <div className={`w-full text-center ${inExponent ? 'pb-[0.02em]' : 'pb-[0.1em]'}`}>
              <PreviewEquationNode
                path={customNode ? undefined : `${path}/0`}
                customNode={customNode ? (node as math.OperatorNode).args[0] : undefined}
                inExponent={inExponent}
                customEquation={customEquation}
              />
            </div>
            <div className={`w-full border-t h-0 ${palette.fractionBar}`} />
            <div className={`w-full text-center ${inExponent ? 'pt-[0.02em]' : 'pt-[0.1em]'}`}>
              <PreviewEquationNode
                path={customNode ? undefined : `${path}/1`}
                customNode={customNode ? (node as math.OperatorNode).args[1] : undefined}
                inExponent={inExponent}
                customEquation={customEquation}
              />
            </div>
          </div>
        );
      }

      // Binary Exponentiation operator (Superscript rendering). Top-anchor the
      // exponent to the base so a tall group base (e.g. (x+2)) can't drop it to
      // the midline where it reads as multiplication — see EquationNode (#194).
      if (opNode.op === '^') {
        return (
          <div className="inline-flex items-start">
            <PreviewEquationNode
              path={customNode ? undefined : `${path}/0`}
              customNode={customNode ? (node as math.OperatorNode).args[0] : undefined}
              inExponent={inExponent}
              customEquation={customEquation}
            />
            <div className="text-[0.65em] ml-[0.05em] opacity-70 scale-90 relative" style={{ top: '-0.4em', display: 'inline-block' }}>
              <PreviewEquationNode
                path={customNode ? undefined : `${path}/1`}
                customNode={customNode ? (node as math.OperatorNode).args[1] : undefined}
                inExponent={true}
                customEquation={customEquation}
              />
            </div>
          </div>
        );
      }

      // Normal binary operators (+, -, *) — centralized display glyphs (#28).
      const opSymbol = OPERATOR_DISPLAY[opNode.op] || opNode.op;

      return (
        <div className="flex items-center gap-[0.2em] flex-nowrap justify-center py-[0.05em]">
          <PreviewEquationNode
            path={customNode ? undefined : `${path}/0`}
            customNode={customNode ? (node as math.OperatorNode).args[0] : undefined}
            inExponent={inExponent}
            customEquation={customEquation}
          />
          <span className={`font-medium text-[0.85em] select-none ${palette.operator}`}>{opSymbol}</span>
          <PreviewEquationNode
            path={customNode ? undefined : `${path}/1`}
            customNode={customNode ? (node as math.OperatorNode).args[1] : undefined}
            inExponent={inExponent}
            customEquation={customEquation}
          />
        </div>
      );
    }

    if (node.type === 'FunctionNode') {
      const funcNode = node as math.FunctionNode;
      const nameStr = getFunctionName(funcNode);

      if (nameStr === 'nthRoot') {
        let showIndex = funcNode.args.length > 1;
        if (showIndex) {
          let unwrapped = funcNode.args[1];
          while (unwrapped && unwrapped.type === 'ParenthesisNode') {
            unwrapped = (unwrapped as math.ParenthesisNode).content;
          }
          if (unwrapped && unwrapped.type === 'ConstantNode' && (((unwrapped as math.ConstantNode).value as unknown) === 2 || ((unwrapped as math.ConstantNode).value as unknown) === '2')) {
            showIndex = false;
          }
        }
        return (
          <div className="flex items-stretch mx-[0.1em] relative">
            {showIndex && (
              // Crook-relative seating for both tall and short indices (#356,
              // mirroring the live renderer's #201). The column is a full-height flex
              // item (stretches to the row); the index content inside is absolutely
              // positioned with its bottom an inset above the crook line
              // (`bottom: (1−crookFraction) of the height`), so it rides the crook
              // whether the index or a taller radicand drives the height. The column
              // reserves the index's measured footprint (minWidth/minHeight from the
              // effect above) so the node box still wraps it (#198). The 0.5em shrink
              // lives on the inner element only — NOT the positioned wrapper, or the em
              // offsets would halve.
              <div
                ref={indexSlotRef}
                className="relative shrink-0 z-10"
                style={{ minWidth: `${indexBox.minW}em`, minHeight: `${indexBox.minH}em` }}
              >
                <div
                  className="absolute"
                  style={{
                    right: `${indexArmRightMarginEm}em`,
                    bottom: `calc(${((1 - crookFraction) * 100).toFixed(4)}% + ${INDEX_INSET_EM.toFixed(4)}em)`,
                  }}
                >
                  <div className="text-[0.5em]">
                    <PreviewEquationNode
                      path={customNode ? undefined : `${path}/1`}
                      customNode={customNode ? (node as math.FunctionNode).args[1] : undefined}
                      inExponent={inExponent}
                      customEquation={customEquation}
                    />
                  </div>
                </div>
              </div>
            )}
            <div
              className="relative select-none shrink-0 mr-[-1px]"
              style={{ width: `${RADICAL_SVG_WIDTH_EM}em` }}
            >
              <svg
                viewBox="0 0 12 100"
                preserveAspectRatio="none"
                className={`absolute inset-0 w-full h-full overflow-visible ${palette.operator}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path
                  d={radicalPath(Math.round(crookFraction * 100))}
                  vectorEffect="non-scaling-stroke"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className={`border-t ${palette.radicalBar} pt-[0.15em] pb-[0.05em] px-[0.15em] rounded-tr-[0.2em] flex items-center`}>
              <PreviewEquationNode
                path={customNode ? undefined : `${path}/0`}
                customNode={customNode ? (node as math.FunctionNode).args[0] : undefined}
                inExponent={inExponent}
                customEquation={customEquation}
              />
            </div>
          </div>
        );
      }

      if (nameStr === 'sqrt') {
        return (
          <div className="flex items-stretch mx-[0.1em] relative">
            <div
              className="relative select-none shrink-0 mr-[-1px]"
              style={{ width: `${RADICAL_SVG_WIDTH_EM}em` }}
            >
              <svg
                viewBox="0 0 12 100"
                preserveAspectRatio="none"
                className={`absolute inset-0 w-full h-full overflow-visible ${palette.operator}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path
                  d={radicalPath(RADICAL_DEFAULT_CROOK_Y)}
                  vectorEffect="non-scaling-stroke"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className={`border-t ${palette.radicalBar} pt-[0.15em] pb-[0.05em] px-[0.15em] rounded-tr-[0.2em] flex items-center`}>
              <PreviewEquationNode
                path={customNode ? undefined : `${path}/0`}
                customNode={customNode ? (node as math.FunctionNode).args[0] : undefined}
                inExponent={inExponent}
                customEquation={customEquation}
              />
            </div>
          </div>
        );
      }

      if (nameStr === 'abs') {
        // Vertical bars stretched to the operand height, matching EquationNode.
        return (
          <div className="flex items-stretch gap-[0.15em]">
            <span className={`self-stretch border-l-[1.5px] ${palette.radicalBar}`} />
            <div className="flex items-center">
              <PreviewEquationNode
                path={customNode ? undefined : `${path}/0`}
                customNode={customNode ? (node as math.FunctionNode).args[0] : undefined}
                inExponent={inExponent}
                customEquation={customEquation}
              />
            </div>
            <span className={`self-stretch border-l-[1.5px] ${palette.radicalBar}`} />
          </div>
        );
      }

      // Default fallback function renderer
      return (
        <div className="flex items-center gap-[0.05em]">
          <span className={`font-medium text-[0.9em] ${palette.fnName}`}>{nameStr}</span>
          <span className={`mr-[0.05em] ${palette.paren}`}>(</span>
          <PreviewEquationNode
            path={customNode ? undefined : `${path}/0`}
            customNode={customNode ? (node as math.FunctionNode).args[0] : undefined}
            inExponent={inExponent}
            customEquation={customEquation}
          />
          <span className={`ml-[0.05em] ${palette.paren}`}>)</span>
        </div>
      );
    }

    return <span>{node.toString()}</span>;
  };

  // In read view a stop is a VISUAL cursor target only (#270): it registers (for
  // depth-first ordering) and shows a ring when active, but carries NO ARIA role or
  // name. The whole render is aria-hidden and a live region narrates the active stop
  // (see ExploreEquationTree) — which sidesteps both the VoiceOver "moving up to a
  // containing item announces 'group'" quirk and the "outline row" treeitem chatter.
  const isActiveStop = isStop && roving?.activeKey === path;
  const exploreProps = isStop ? { ref: registerExploreItem } : {};

  return (
    <div
      data-flip-id={nodeId}
      className={`relative inline-flex items-center justify-center ${isActiveStop ? THEME_GLASS.EXPLORE_CURSOR : ''}`}
      {...exploreProps}
    >
      {renderContent()}
    </div>
  );
};
