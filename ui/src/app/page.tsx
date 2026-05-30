'use client';

import React from 'react';
import { useAtomValue } from 'jotai';
import { EquationNode } from '../components/EquationNode';
import { PreviewEquationNode } from '../components/PreviewEquationNode';
import { Sidebar } from '../components/Sidebar';
import { ControlPanel } from '../components/ControlPanel';
import {
  currentEquationAtom,
  hoverPathAtom,
  targetPathsAtom,
  hoverReducePathAtom,
} from '../store/equation';
import { THEME_GLASS, THEME_ANIMATIONS } from '../constants/theme';
import { Sparkles, HelpCircle } from 'lucide-react';

export default function Home() {
  const currentEq = useAtomValue(currentEquationAtom);
  const hoverPath = useAtomValue(hoverPathAtom);
  const targetPaths = useAtomValue(targetPathsAtom);
  const hoverReducePath = useAtomValue(hoverReducePathAtom);
  const isSpeculative = (hoverPath !== null && hoverPath in targetPaths) || hoverReducePath !== null;

  const boundingBoxRef = React.useRef<Map<string, DOMRect>>(new Map());

  React.useLayoutEffect(() => {
    const canvas = document.querySelector('.active-workspace-canvas');
    if (!canvas) return;

    const elements = Array.from(canvas.querySelectorAll('[data-flip-id]')) as HTMLElement[];
    const firstRects = boundingBoxRef.current;
    const lastRects = new Map<string, DOMRect>();

    // 1. First Pass: Capture all new positions (Last)
    elements.forEach((el) => {
      const id = el.getAttribute('data-flip-id');
      if (id) {
        lastRects.set(id, el.getBoundingClientRect());
      }
    });

    // Map to keep track of calculated translations to prevent double translation in nested structures
    const appliedTranslations = new Map<string, { dx: number; dy: number }>();

    // 2. Second Pass: Invert and Play
    elements.forEach((el) => {
      const id = el.getAttribute('data-flip-id');
      if (!id) return;

      const firstRect = firstRects.get(id);
      const lastRect = lastRects.get(id);

      if (firstRect && lastRect) {
        // Calculate viewport-space deltas
        const viewportDx = firstRect.left - lastRect.left;
        const viewportDy = firstRect.top - lastRect.top;

        if (viewportDx !== 0 || viewportDy !== 0) {
          // Find the nearest ancestor that is also active and has a stable ID
          let ancestor: HTMLElement | null = el.parentElement;
          let nearestAncestorId: string | null = null;

          while (ancestor && ancestor !== canvas) {
            const ancestorId = ancestor.getAttribute('data-flip-id');
            if (ancestorId && firstRects.has(ancestorId)) {
              nearestAncestorId = ancestorId;
              break;
            }
            ancestor = ancestor.parentElement;
          }

          // Solve the Nested Transform Problem:
          // Subtract the ancestor's translation to prevent compounding layout transforms!
          let dx = viewportDx;
          let dy = viewportDy;

          if (nearestAncestorId) {
            const ancestorTrans = appliedTranslations.get(nearestAncestorId);
            if (ancestorTrans) {
              dx -= ancestorTrans.dx;
              dy -= ancestorTrans.dy;
            }
          }

          // Store the translation we are applying to this node
          appliedTranslations.set(id, { dx: viewportDx, dy: viewportDy });

          if (dx !== 0 || dy !== 0) {
            // INVERT: Put element back to its starting position instantly
            el.style.transform = `translate(${dx}px, ${dy}px)`;
            el.style.transition = 'none';

            // PLAY: Animate it smoothly to its new layout position
            requestAnimationFrame(() => {
              el.style.transform = '';
              el.style.transition = `transform ${THEME_ANIMATIONS.TRANSITION_DURATION_MS}ms cubic-bezier(0.25, 1, 0.5, 1)`;

              // Clean up styles to restore React control after animation completes
              const cleanup = (e: TransitionEvent) => {
                if (e.propertyName === 'transform') {
                  el.style.transform = '';
                  el.style.transition = '';
                  el.removeEventListener('transitionend', cleanup);
                }
              };
              el.addEventListener('transitionend', cleanup);
            });
          }
        }
      }
    });

    // 3. Update Ref Map with current coordinates for the next render
    boundingBoxRef.current = lastRects;
  }, [currentEq]);

  return (
    <div className="relative flex h-screen w-screen overflow-hidden bg-[radial-gradient(ellipse_at_top_right,rgba(30,27,75,0.8),rgba(10,10,12,1))] text-white font-sans">
      {/* Background neon grid effect */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none -z-10" />

      {/* Decorative ambient glow orbs */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -z-10 animate-pulse" />
      <div className="absolute bottom-10 left-1/4 w-96 h-96 bg-sky-500/5 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* 1. Left Control Sidebar (Loader, Global Operations, Presets Library) */}
      <Sidebar />

      {/* Main workspace section */}
      <main className="flex-1 flex flex-col h-full min-w-0">
        {/* Top Header */}
        <header className="h-16 border-b border-white/10 px-8 flex items-center justify-between select-none">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/30">
              <Sparkles size={16} className="text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white tracking-wide">Algebranch</h1>
              <p className="text-[10px] text-indigo-300 font-semibold tracking-wider uppercase">
                Interactive Algebraic Derivation
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-white/50 bg-white/5 px-3 py-1.5 border border-white/10 rounded-full">
            <HelpCircle size={14} className="text-indigo-400" />
            <span>Click nodes to select. Click green slots to relocate.</span>
          </div>
        </header>

        {/* Central Workspace Area */}
        <div className="flex-1 flex gap-6 p-8 min-h-0">
          {/* Equation Editor Canvas */}
          <div className="flex-1 flex flex-col gap-6 min-w-0">
            <div className={`flex-1 flex flex-col h-full min-h-0 relative ${THEME_GLASS.PANEL}`}>
              
              {/* 1. Active Derivation Workspace (Top 50%) */}
              <div className="active-workspace-canvas flex-1 flex flex-col items-center justify-center min-h-0 w-full overflow-auto p-8 text-2xl md:text-3xl lg:text-[2.2rem] font-light">
                <div className="flex flex-col items-center justify-center gap-2">
                  <span className="text-[10px] text-indigo-400 font-semibold tracking-wider uppercase select-none">
                    Active Workspace
                  </span>
                  <div className="flex items-center justify-center gap-[0.8em] flex-wrap max-w-full">
                    {/* LHS Term Tree */}
                    <div className="flex justify-end min-w-[5em]">
                      <EquationNode path="lhs" key={(currentEq?.lhs as unknown as { id?: string })?.id || 'lhs'} />
                    </div>

                    {/* Equals Operator sign */}
                    <span className="text-[1.2em] font-light font-mono text-indigo-400 select-none px-[0.6em] py-[0.2em] bg-indigo-500/5 border border-indigo-500/10 rounded-[0.4em] shadow-inner shadow-black">
                      =
                    </span>

                    {/* RHS Term Tree */}
                    <div className="flex justify-start min-w-[5em]">
                      <EquationNode path="rhs" key={(currentEq?.rhs as unknown as { id?: string })?.id || 'rhs'} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Elegant Dashed Separator */}
              <div className="w-11/12 border-t border-dashed border-white/10 shrink-0 self-center" />

              {/* 2. Speculative Preview Workspace (Bottom 50%) */}
              <div className="flex-1 flex flex-col items-center justify-center min-h-0 w-full overflow-auto p-8 text-2xl md:text-3xl lg:text-[2.2rem] font-light">
                <div className={`flex flex-col items-center justify-center gap-2 transition-all duration-300 ${
                  isSpeculative ? 'opacity-70 scale-100' : 'opacity-30 scale-95'
                }`}>
                  <span className={`text-[10px] font-semibold tracking-wider uppercase select-none flex items-center gap-1.5 transition-colors duration-300 ${
                    isSpeculative ? 'text-emerald-400' : 'text-zinc-500'
                  }`}>
                    <span>Derivation Preview</span>
                    {isSpeculative && (
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
                    )}
                  </span>
                  
                  <div className="flex items-center justify-center gap-[0.8em] flex-wrap max-w-full pointer-events-none select-none">
                    {/* LHS Preview Term Tree */}
                    <div className="flex justify-end min-w-[5em]">
                      <PreviewEquationNode path="lhs" />
                    </div>

                    {/* Equals Operator sign */}
                    <span className={`text-[1.2em] font-light font-mono select-none px-[0.6em] py-[0.2em] border rounded-[0.4em] transition-all duration-300 ${
                      isSpeculative
                        ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5'
                        : 'text-zinc-600 border-zinc-500/10 bg-zinc-500/5'
                    }`}>
                      =
                    </span>

                    {/* RHS Preview Term Tree */}
                    <div className="flex justify-start min-w-[5em]">
                      <PreviewEquationNode path="rhs" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Tips or Info footer */}
            <footer className="text-xs text-white/40 flex items-center justify-between px-2 select-none">
              <span>Algebranch Math Engine v1.0.0</span>
              <div className="flex gap-4">
                <span className="hover:text-white/60 transition-colors">Interval Arithmetic Validation</span>
                <span className="hover:text-white/60 transition-colors">TDD Move Proofs</span>
              </div>
            </footer>
          </div>

          {/* Right History & Derivations Sidebar */}
          <div className="w-80 flex flex-col shrink-0">
            <ControlPanel />
          </div>
        </div>
      </main>
    </div>
  );
}
