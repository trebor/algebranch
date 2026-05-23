'use client';

import React from 'react';
import { useAtomValue } from 'jotai';
import { EquationNode } from '../components/EquationNode';
import { PreviewEquationNode } from '../components/PreviewEquationNode';
import { Sidebar } from '../components/Sidebar';
import { ControlPanel } from '../components/ControlPanel';
import {
  selectedPathAtom,
  currentEquationAtom,
  hoverPathAtom,
  validDropPathsAtom,
} from '../store/equation';
import { THEME_GLASS } from '../constants/theme';
import { Info, Sparkles, HelpCircle } from 'lucide-react';

export default function Home() {
  const selectedPath = useAtomValue(selectedPathAtom);
  const currentEq = useAtomValue(currentEquationAtom);
  const hoverPath = useAtomValue(hoverPathAtom);
  const validDrops = useAtomValue(validDropPathsAtom);
  const isSpeculative = hoverPath !== null && hoverPath in validDrops;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[radial-gradient(ellipse_at_top_right,rgba(30,27,75,0.8),rgba(10,10,12,1))] text-white font-sans">
      {/* Background neon grid effect */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none -z-10" />

      {/* Decorative ambient glow orbs */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -z-10 animate-pulse" />
      <div className="absolute bottom-10 left-1/4 w-96 h-96 bg-sky-500/5 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* 1. Timeline & Presets Sidebar */}
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
              <div className="flex-1 flex flex-col items-center justify-center min-h-0 w-full overflow-auto p-8">
                <div className="flex flex-col items-center justify-center gap-2">
                  <span className="text-[10px] text-indigo-400 font-semibold tracking-wider uppercase select-none">
                    Active Workspace
                  </span>
                  <div className="flex items-center justify-center gap-8 flex-wrap max-w-full">
                    {/* LHS Term Tree */}
                    <div className="flex justify-end min-w-[200px]">
                      <EquationNode path="lhs" />
                    </div>

                    {/* Equals Operator sign */}
                    <span className="text-3xl font-light font-mono text-indigo-400 select-none px-4 py-2 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl shadow-inner shadow-black">
                      =
                    </span>

                    {/* RHS Term Tree */}
                    <div className="flex justify-start min-w-[200px]">
                      <EquationNode path="rhs" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Elegant Dashed Separator */}
              <div className="w-11/12 border-t border-dashed border-white/10 shrink-0 self-center" />

              {/* 2. Speculative Preview Workspace (Bottom 50%) */}
              <div className="flex-1 flex flex-col items-center justify-center min-h-0 w-full overflow-auto p-8 pb-16">
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
                  
                  <div className="flex items-center justify-center gap-8 flex-wrap max-w-full pointer-events-none select-none">
                    {/* LHS Preview Term Tree */}
                    <div className="flex justify-end min-w-[200px]">
                      <PreviewEquationNode path="lhs" />
                    </div>

                    {/* Equals Operator sign */}
                    <span className={`text-3xl font-light font-mono select-none px-4 py-2 border rounded-2xl transition-all duration-300 ${
                      isSpeculative
                        ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5'
                        : 'text-zinc-600 border-zinc-500/10 bg-zinc-500/5'
                    }`}>
                      =
                    </span>

                    {/* RHS Preview Term Tree */}
                    <div className="flex justify-start min-w-[200px]">
                      <PreviewEquationNode path="rhs" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Glowing instruction panel at bottom of canvas */}
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-neutral-950/80 border border-white/15 px-4 py-2 rounded-full text-xs text-indigo-200 select-none max-w-[85%] text-center shadow-2xl backdrop-blur-md z-30">
                <Info size={14} className="text-indigo-400 shrink-0" />
                <span>
                  {selectedPath
                    ? 'Slot Selected! Hover over a green slot to preview the new equation below, click it to apply.'
                    : 'Click an operator card or term variable box in the equation tree to start a derivation step.'}
                </span>
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

          {/* Right Control & Operations Sidebar */}
          <div className="w-80 flex flex-col shrink-0">
            <ControlPanel />
          </div>
        </div>
      </main>
    </div>
  );
}
