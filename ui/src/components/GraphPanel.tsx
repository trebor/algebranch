// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

'use client';

import React from 'react';
import { useAtomValue, useAtom } from 'jotai';
import { currentEquationAtom, graphDataAtom, graphSizeAtom, customViewportAtom } from '../store/equation';
import { THEME_GLASS } from '../constants/theme';
import { Tooltip } from './Tooltip';
import { evaluatePoint, formatNumber } from 'math-engine';
import type * as math from 'mathjs';

const GRAPH_BACKGROUND_COLOR = '#050508';

// niceTicks function generates neat division points for plotting
function niceTicks(min: number, max: number, count = 5): number[] {
  const range = max - min;
  if (range <= 0) return [min];
  const roughStep = range / (count - 1);
  const log = Math.log10(roughStep);
  const power = Math.floor(log);
  const base = Math.pow(10, power);
  const normalized = roughStep / base;
  
  let step = base;
  if (normalized < 1.5) step = base;
  else if (normalized < 3) step = 2 * base;
  else if (normalized < 7) step = 5 * base;
  else step = 10 * base;
  
  const start = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  for (let val = start; val <= max + 1e-9; val += step) {
    ticks.push(Number(val.toFixed(Math.max(0, -power + 1))));
  }
  return ticks.filter(t => t >= min && t <= max);
}

const nodeToString = (node: math.MathNode): string => {
  const options = {
    handler: (n: math.MathNode): string | undefined => {
      if (n.type === 'ConstantNode') {
        return formatNumber((n as math.ConstantNode).value);
      }
      return undefined;
    }
  };
  return node.toString(options);
};

export const GraphPanel: React.FC = () => {
  const eq = useAtomValue(currentEquationAtom);
  const graphData = useAtomValue(graphDataAtom);
  const graphSize = useAtomValue(graphSizeAtom);
  const [, setCustomViewport] = useAtom(customViewportAtom);
  
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = React.useState({ width: 360, height: 260 });
  
  // Ref to track dragging bounds
  const dragStartRef = React.useRef<{
    screenX: number;
    screenY: number;
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
  } | null>(null);

  // Interactive UI states
  const [isDragging, setIsDragging] = React.useState(false);
  const [hoveredCurve, setHoveredCurve] = React.useState<'lhs' | 'rhs' | null>(null);
  const [hoveredLegend, setHoveredLegend] = React.useState<'lhs' | 'rhs' | null>(null);
  const [mousePos, setMousePos] = React.useState<{ x: number; y: number } | null>(null);
  const [isHoveringIntersection, setIsHoveringIntersection] = React.useState(false);

  const activeHover = hoveredCurve || hoveredLegend;

  // Reset custom viewport when changing equations to auto-center
  React.useEffect(() => {
    setCustomViewport(null);
  }, [eq, setCustomViewport]);

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const measure = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      if (width > 0 && height > 0) {
        setDimensions({ width, height });
      }
    };

    // Run adjustment immediately
    measure();

    // Set up ResizeObserver
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          if (width > 0 && height > 0) {
            setDimensions({ width, height });
          }
        }
      });
      observer.observe(container);
    }

    // Schedule measurements after animations/transitions complete to resolve layout race conditions.
    // The panel transitions height via transition-all duration-300 ease-in-out.
    // Multiple intervals ensure the SVG viewport is updated during and at the end of the transition.
    const timers = [
      setTimeout(measure, 100),
      setTimeout(measure, 200),
      setTimeout(measure, 350),
      setTimeout(measure, 500),
    ];

    const handleResize = () => measure();
    window.addEventListener('resize', handleResize);

    return () => {
      if (observer) {
        observer.disconnect();
      }
      window.removeEventListener('resize', handleResize);
      timers.forEach(clearTimeout);
    };
  }, [graphSize]);

  if (!eq || !graphData) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center text-sm text-white/40">
        No equation to graph.
      </div>
    );
  }

  const { variable, reason, variables, lhs, rhs, intersections, window: graphWindow } = graphData;
  const { xMin, xMax, yMin, yMax } = graphWindow;

  if (reason === 'multi-variable') {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center gap-2">
        <p className={`${THEME_GLASS.TEXT_MUTED} text-sm`}>
          Graphs are available for single-variable equations.
        </p>
        <div className="flex flex-wrap justify-center gap-1.5 mt-2">
          {variables.map((v) => (
            <span key={v} className={`${THEME_GLASS.BADGE_MUTED} px-2 py-0.5 text-xs font-mono`}>
              {v}
            </span>
          ))}
        </div>
      </div>
    );
  }

  if (reason === 'no-variables') {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <p className={`${THEME_GLASS.TEXT_MUTED} text-sm`}>
          Nothing to graph — no variables.
        </p>
      </div>
    );
  }

  if (!variable) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <p className={`${THEME_GLASS.TEXT_MUTED} text-sm`}>
          Unable to graph equation.
        </p>
      </div>
    );
  }

  const W = dimensions.width;
  const H = dimensions.height;
  
  // Minimal padding to keep outer grid boundary border stroke visible
  const padding = { left: 1, right: 1, top: 1, bottom: 1 };
  const plotWidth = Math.max(10, W - padding.left - padding.right);
  const plotHeight = Math.max(10, H - padding.top - padding.bottom);

  const toSvgX = (x: number) => {
    return padding.left + ((x - xMin) / (xMax - xMin)) * plotWidth;
  };
  const toSvgY = (y: number) => {
    return padding.top + plotHeight - ((y - yMin) / (yMax - yMin)) * plotHeight;
  };

  const evalReal = (node: math.MathNode, x: number): number | null => {
    try {
      const v = evaluatePoint(node, { [variable]: x });
      if (typeof v === 'number') return Number.isFinite(v) ? v : null;
      if (v && typeof v === 'object') {
        if ('im' in v) return Math.abs(v.im) < 1e-9 && Number.isFinite(v.re) ? v.re : null;
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
      }
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    } catch {
      return null;
    }
  };

  const lhsVal = mousePos ? evalReal(eq.lhs, mousePos.x) : null;
  const rhsVal = mousePos ? evalReal(eq.rhs, mousePos.x) : null;

  // Group curve samples into contiguous segments where y !== null
  const getSegments = (samples: { x: number; y: number | null }[]) => {
    const segments: { x: number; y: number }[][] = [];
    let current: { x: number; y: number }[] = [];
    for (const sample of samples) {
      if (sample.y !== null && isFinite(sample.y)) {
        current.push({ x: sample.x, y: sample.y });
      } else {
        if (current.length > 0) {
          segments.push(current);
          current = [];
        }
      }
    }
    if (current.length > 0) {
      segments.push(current);
    }
    return segments;
  };

  const lhsSegments = getSegments(lhs);
  const rhsSegments = getSegments(rhs);

  const makePathD = (segment: { x: number; y: number }[]) => {
    return segment
      .map((p, idx) => {
        const sx = toSvgX(p.x);
        const sy = toSvgY(p.y);
        return `${idx === 0 ? 'M' : 'L'} ${sx.toFixed(1)} ${sy.toFixed(1)}`;
      })
      .join(' ');
  };

  // Calculate ticks
  const xTicks = niceTicks(xMin, xMax, Math.max(3, Math.min(6, Math.floor(W / 80))));
  const yTicks = niceTicks(yMin, yMax, Math.max(3, Math.min(6, Math.floor(H / 60))));

  // Handle tracking mouse/touch drag coordinate panning & hover crosshairs
  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return; // Only left-click / touch contact
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStartRef.current = {
      screenX: e.clientX,
      screenY: e.clientY,
      xMin,
      xMax,
      yMin,
      yMax
    };
    setIsDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const start = dragStartRef.current;
    
    // 1. Hover coordinate tracking (if not dragging)
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * W;
    const my = ((e.clientY - rect.top) / rect.height) * H;
    
    if (
      mx >= padding.left &&
      mx <= W - padding.right &&
      my >= padding.top &&
      my <= H - padding.bottom
    ) {
      const xVal = xMin + ((mx - padding.left) / plotWidth) * (xMax - xMin);
      const yVal = yMin + ((plotHeight - (my - padding.top)) / plotHeight) * (yMax - yMin);
      // Freeze crosshairs read-out at drag start location if dragging to avoid jitter
      if (!start) {
        setMousePos({ x: xVal, y: yVal });
      }
    } else {
      if (!start) {
        setMousePos(null);
      }
    }

    if (!start) return;

    // 2. Active panning logic
    const dx = e.clientX - start.screenX;
    const dy = e.clientY - start.screenY;
    
    const deltaX = -dx * (start.xMax - start.xMin) / plotWidth;
    const deltaY = dy * (start.yMax - start.yMin) / plotHeight;
    
    setCustomViewport({
      xMin: start.xMin + deltaX,
      xMax: start.xMax + deltaX,
      yMin: start.yMin + deltaY,
      yMax: start.yMax + deltaY
    });
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (dragStartRef.current) {
      e.currentTarget.releasePointerCapture(e.pointerId);
      dragStartRef.current = null;
    }
    setIsDragging(false);
  };

  const handlePointerCancel = (e: React.PointerEvent<SVGSVGElement>) => {
    if (dragStartRef.current) {
      e.currentTarget.releasePointerCapture(e.pointerId);
      dragStartRef.current = null;
    }
    setIsDragging(false);
  };

  return (
    <div className="flex flex-col h-full w-full select-none overflow-hidden">
      {/* Legend */}
      <div className="flex flex-wrap justify-center items-center gap-4 py-1.5 border-b border-white/5 bg-white/[0.01] shrink-0">
        <div 
          onMouseEnter={() => setHoveredLegend('lhs')}
          onMouseLeave={() => setHoveredLegend(null)}
          className={`flex items-center gap-1.5 cursor-pointer transition-all duration-150 ${
            activeHover === 'lhs' ? 'scale-[1.03]' : activeHover === 'rhs' ? 'opacity-40' : ''
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${THEME_GLASS.GRAPH_SWATCH_LHS}`} />
          <span className={THEME_GLASS.GRAPH_LEGEND_CHIP}>{nodeToString(eq.lhs)}</span>
        </div>
        <div 
          onMouseEnter={() => setHoveredLegend('rhs')}
          onMouseLeave={() => setHoveredLegend(null)}
          className={`flex items-center gap-1.5 cursor-pointer transition-all duration-150 ${
            activeHover === 'rhs' ? 'scale-[1.03]' : activeHover === 'lhs' ? 'opacity-40' : ''
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${THEME_GLASS.GRAPH_SWATCH_RHS}`} />
          <span className={THEME_GLASS.GRAPH_LEGEND_CHIP}>{nodeToString(eq.rhs)}</span>
        </div>
      </div>

      {/* SVG Container */}
      <div ref={containerRef} className="flex-1 min-h-0 w-full relative bg-[#050508]">
        {/* Floating Curve Value Tooltip */}
        {mousePos && !isHoveringIntersection && !isDragging && (() => {
          const tooltipWidth = 110;
          const tooltipHeight = 58;
          
          let tooltipLeft = toSvgX(mousePos.x) + 16;
          let tooltipTop = toSvgY(mousePos.y) - 16;
          
          // Collision detection: flip left if going off the right edge of SVG viewport area
          if (tooltipLeft + tooltipWidth > W) {
            tooltipLeft = toSvgX(mousePos.x) - tooltipWidth - 16;
          }
          if (tooltipLeft < 8) {
            tooltipLeft = 8;
          }
          
          // Collision detection: flip down if going off the top edge of SVG viewport area
          if (tooltipTop < 8) {
            tooltipTop = toSvgY(mousePos.y) + 16;
          }
          if (tooltipTop + tooltipHeight > H) {
            tooltipTop = H - tooltipHeight - 8;
          }

          const getRowClass = (side: 'lhs' | 'rhs') => {
            if (!activeHover) return THEME_GLASS.GRAPH_TOOLTIP_ROW_DEFAULT;
            return activeHover === side 
              ? THEME_GLASS.GRAPH_TOOLTIP_ROW_ACTIVE 
              : THEME_GLASS.GRAPH_TOOLTIP_ROW_INACTIVE;
          };

          return (
            <div 
              className={THEME_GLASS.GRAPH_TOOLTIP}
              style={{
                left: `${tooltipLeft}px`,
                top: `${tooltipTop}px`,
              }}
            >
              <div className={THEME_GLASS.GRAPH_TOOLTIP_HEADER}>
                <span className={`${THEME_GLASS.TEXT_MUTED} font-sans text-xs mr-1 select-none`}>↔</span>
                <span>{formatNumber(mousePos.x)}</span>
              </div>
              {lhsVal !== null && (
                <div className={getRowClass('lhs')}>
                  <span className={`w-1.5 h-1.5 rounded-full ${THEME_GLASS.GRAPH_SWATCH_LHS}`} />
                  <span>{formatNumber(lhsVal)}</span>
                </div>
              )}
              {rhsVal !== null && (
                <div className={getRowClass('rhs')}>
                  <span className={`w-1.5 h-1.5 rounded-full ${THEME_GLASS.GRAPH_SWATCH_RHS}`} />
                  <span>{formatNumber(rhsVal)}</span>
                </div>
              )}
            </div>
          );
        })()}
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          height="100%"
          className={`absolute inset-0 overflow-visible select-none touch-none ${
            isDragging ? 'cursor-grabbing' : 'cursor-grab'
          }`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          onPointerLeave={() => {
            if (!isDragging) {
              setMousePos(null);
              setIsHoveringIntersection(false);
            }
          }}
        >
          {/* Definitions */}
          <defs>
            <clipPath id="plot-clip">
              <rect
                x={padding.left}
                y={padding.top}
                width={plotWidth}
                height={plotHeight}
              />
            </clipPath>
          </defs>

          {/* Grid lines */}
          <g>
            {xTicks.map(val => {
              const sx = toSvgX(val);
              return (
                <line
                  key={`grid-x-${val}`}
                  x1={sx}
                  y1={padding.top}
                  x2={sx}
                  y2={padding.top + plotHeight}
                  className={THEME_GLASS.GRAPH_GRID_LINE}
                  strokeWidth={1}
                />
              );
            })}
            {yTicks.map(val => {
              const sy = toSvgY(val);
              return (
                <line
                  key={`grid-y-${val}`}
                  x1={padding.left}
                  y1={sy}
                  x2={W - padding.right}
                  y2={sy}
                  className={THEME_GLASS.GRAPH_GRID_LINE}
                  strokeWidth={1}
                />
              );
            })}
          </g>

          {/* Axes at zero */}
          {yMin <= 0 && yMax >= 0 && (
            <line
              x1={padding.left}
              y1={toSvgY(0)}
              x2={W - padding.right}
              y2={toSvgY(0)}
              className={THEME_GLASS.GRAPH_AXIS}
              strokeWidth={1.5}
            />
          )}
          {xMin <= 0 && xMax >= 0 && (
            <line
              x1={toSvgX(0)}
              y1={padding.top}
              x2={toSvgX(0)}
              y2={padding.top + plotHeight}
              className={THEME_GLASS.GRAPH_AXIS}
              strokeWidth={1.5}
            />
          )}

          {/* Ticks and Labels (All inside the plot boundary box) */}
          {/* X Ticks & Labels */}
          <g>
            {xTicks.map(val => {
              const sx = toSvgX(val);
              const isZero = Math.abs(val) < 1e-9;
              return (
                <g key={`tick-x-${val}`}>
                  <line
                    x1={sx}
                    y1={H - padding.bottom - 4}
                    x2={sx}
                    y2={H - padding.bottom}
                    className={THEME_GLASS.GRAPH_TICK_LINE}
                    strokeWidth={1}
                  />
                  <text
                    x={sx}
                    y={H - padding.bottom - 8}
                    textAnchor="middle"
                    className={`${THEME_GLASS.GRAPH_TICK_TEXT} fill-white/50 text-[0.5625rem]`}
                    style={{
                      paintOrder: 'stroke fill',
                      stroke: GRAPH_BACKGROUND_COLOR,
                      strokeWidth: '4px',
                      strokeLinejoin: 'round'
                    }}
                  >
                    {isZero ? '0' : formatNumber(val)}
                  </text>
                </g>
              );
            })}
          </g>

          {/* Y Ticks & Labels */}
          <g>
            {yTicks.map(val => {
              const sy = toSvgY(val);
              const isZero = Math.abs(val) < 1e-9;
              // Don't duplicate zero label at bottom-left corner
              if (isZero && xMin <= 0 && xMax >= 0) return null;
              return (
                <g key={`tick-y-${val}`}>
                  <line
                    x1={padding.left}
                    y1={sy}
                    x2={padding.left + 4}
                    y2={sy}
                    className={THEME_GLASS.GRAPH_TICK_LINE}
                    strokeWidth={1}
                  />
                  <text
                    x={padding.left + 8}
                    y={sy}
                    textAnchor="start"
                    dominantBaseline="central"
                    className={`${THEME_GLASS.GRAPH_TICK_TEXT} fill-white/50 text-[0.5625rem]`}
                    style={{
                      paintOrder: 'stroke fill',
                      stroke: GRAPH_BACKGROUND_COLOR,
                      strokeWidth: '4px',
                      strokeLinejoin: 'round'
                    }}
                  >
                    {formatNumber(val)}
                  </text>
                </g>
              );
            })}
          </g>

          {/* Curves (Clipped to plot area) */}
          <g clipPath="url(#plot-clip)">
            {lhsSegments.map((seg, i) => (
              <path
                key={`lhs-seg-${i}`}
                d={makePathD(seg)}
                fill="none"
                onMouseEnter={() => setHoveredCurve('lhs')}
                onMouseLeave={() => setHoveredCurve(null)}
                strokeWidth={activeHover === 'lhs' ? 3.5 : activeHover === 'rhs' ? 1.5 : 2.5}
                opacity={activeHover === 'rhs' ? 0.35 : 1}
                className={`${THEME_GLASS.GRAPH_CURVE_LHS} transition-opacity duration-150 cursor-pointer`}
              />
            ))}
            {rhsSegments.map((seg, i) => (
              <path
                key={`rhs-seg-${i}`}
                d={makePathD(seg)}
                fill="none"
                onMouseEnter={() => setHoveredCurve('rhs')}
                onMouseLeave={() => setHoveredCurve(null)}
                strokeWidth={activeHover === 'rhs' ? 3.5 : activeHover === 'lhs' ? 1.5 : 2.5}
                opacity={activeHover === 'lhs' ? 0.35 : 1}
                className={`${THEME_GLASS.GRAPH_CURVE_RHS} transition-opacity duration-150 cursor-pointer`}
              />
            ))}
          </g>

          {/* Intersections (Dashed vertical line + Circle marker) */}
          <g>
            {intersections.map((rx, idx) => {
              const sx = toSvgX(rx);
              const yVal = evalReal(eq.lhs, rx);
              const sy = yVal !== null ? toSvgY(yVal) : null;
              const cleanRx = Number(rx.toFixed(4));
              const cleanRy = sy !== null && yVal !== null ? Number(yVal.toFixed(4)) : null;

              return (
                <Tooltip
                  key={`intersection-${idx}`}
                  content={
                    <div className="px-2 py-1 text-xs font-mono leading-none">
                      <span className="text-emerald-400 font-bold">{variable} = {formatNumber(cleanRx)}</span>
                      {cleanRy !== null && (
                        <span className="text-white/40 block mt-1">val = {formatNumber(cleanRy)}</span>
                      )}
                    </div>
                  }
                  position="top"
                >
                  <g 
                    className="cursor-pointer group select-none"
                    onMouseEnter={() => setIsHoveringIntersection(true)}
                    onMouseLeave={() => setIsHoveringIntersection(false)}
                  >
                    <line
                      x1={sx}
                      y1={padding.top}
                      x2={sx}
                      y2={padding.top + plotHeight}
                      className={`${THEME_GLASS.GRAPH_INTERSECTION_LINE} group-hover:stroke-emerald-400/50 transition-colors`}
                      strokeDasharray="4 4"
                      strokeWidth={1.5}
                    />
                    {sy !== null && (
                      <circle
                        cx={sx}
                        cy={sy}
                        r={5.5}
                        className={`${THEME_GLASS.GRAPH_INTERSECTION_DOT} transition-transform duration-150 origin-center group-hover:scale-125`}
                      />
                    )}
                  </g>
                </Tooltip>
              );
            })}
          </g>

          {/* Cursor vertical scanner and curve value indicator dots */}
          {mousePos && (
            <g className="pointer-events-none select-none">
              <line
                x1={toSvgX(mousePos.x)}
                y1={padding.top}
                x2={toSvgX(mousePos.x)}
                y2={padding.top + plotHeight}
                className={THEME_GLASS.GRAPH_GUIDE_LINE}
                strokeDasharray="2 2"
                strokeWidth={1}
              />
              {lhsVal !== null && (
                <circle
                  cx={toSvgX(mousePos.x)}
                  cy={toSvgY(lhsVal)}
                  r={4}
                  className="fill-indigo-400 stroke-[#050508] stroke-1"
                />
              )}
              {rhsVal !== null && (
                <circle
                  cx={toSvgX(mousePos.x)}
                  cy={toSvgY(rhsVal)}
                  r={4}
                  className="fill-amber-400 stroke-[#050508] stroke-1"
                />
              )}
            </g>
          )}

        </svg>
      </div>
    </div>
  );
};
