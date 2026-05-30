'use client';

import React from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import * as math from 'mathjs';
import { Equation } from 'math-engine';
import {
  currentEquationAtom,
  pushEquationAtom,
  resetToEquationStringAtom,
} from '../store/equation';
import { MATH_PRESETS, THEME_GLASS, THEME_TRANSITIONS } from '../constants/theme';
import { Terminal, ShieldAlert, Plus, Minus, X, Percent, Hash, Play, BookOpen, Sparkles } from 'lucide-react';

// Global Index Value Constants
const CONST_POWER_TWO = 2;

export const Sidebar: React.FC = () => {
  const currentEq = useAtomValue(currentEquationAtom);
  const pushEquation = useSetAtom(pushEquationAtom);
  const resetToEquation = useSetAtom(resetToEquationStringAtom);

  const [inputStr, setInputStr] = React.useState('');
  const [errorStr, setErrorStr] = React.useState<string | null>(null);
  const [termInput, setTermInput] = React.useState('');

  const handleLoadCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputStr.trim()) return;

    try {
      setErrorStr(null);
      resetToEquation(inputStr);
      setInputStr('');
    } catch (err) {
      setErrorStr(err instanceof Error ? err.message : String(err));
    }
  };

  const applyGlobalOp = (type: 'square' | 'sqrt' | 'add' | 'sub' | 'mul' | 'div') => {
    try {
      setErrorStr(null);
      let nextLhs: math.MathNode;
      let nextRhs: math.MathNode;

      if (type === 'square') {
        const exponentNode = new math.ConstantNode(CONST_POWER_TWO);
        nextLhs = new math.OperatorNode('^', 'pow', [currentEq.lhs, exponentNode]);
        nextRhs = new math.OperatorNode('^', 'pow', [currentEq.rhs, exponentNode]);
      } else if (type === 'sqrt') {
        nextLhs = new math.FunctionNode('sqrt', [currentEq.lhs]);
        nextRhs = new math.FunctionNode('sqrt', [currentEq.rhs]);
      } else {
        // Operations requiring a custom parsed term
        if (!termInput.trim()) {
          setErrorStr('Please specify a term to apply to both sides (e.g. 5x).');
          return;
        }

        const parsedTerm = math.parse(termInput.trim());

        if (type === 'add') {
          nextLhs = new math.OperatorNode('+', 'add', [currentEq.lhs, parsedTerm]);
          nextRhs = new math.OperatorNode('+', 'add', [currentEq.rhs, parsedTerm]);
        } else if (type === 'sub') {
          nextLhs = new math.OperatorNode('-', 'subtract', [currentEq.lhs, parsedTerm]);
          nextRhs = new math.OperatorNode('-', 'subtract', [currentEq.rhs, parsedTerm]);
        } else if (type === 'mul') {
          nextLhs = new math.OperatorNode('*', 'multiply', [currentEq.lhs, parsedTerm]);
          nextRhs = new math.OperatorNode('*', 'multiply', [currentEq.rhs, parsedTerm]);
        } else {
          nextLhs = new math.OperatorNode('/', 'divide', [currentEq.lhs, parsedTerm]);
          nextRhs = new math.OperatorNode('/', 'divide', [currentEq.rhs, parsedTerm]);
        }
      }

      const nextEq: Equation = { lhs: nextLhs, rhs: nextRhs };
      pushEquation(nextEq);
      setTermInput('');
    } catch (err) {
      setErrorStr(`Failed to apply operation: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handlePresetSelect = (eqStr: string) => {
    try {
      setErrorStr(null);
      resetToEquation(eqStr);
    } catch (err) {
      setErrorStr(`Error loading preset: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <div className={`w-80 h-full flex flex-col gap-6 p-5 ${THEME_GLASS.PANEL}`}>
      {/* Sidebar Header */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-4 shrink-0">
        <BookOpen className="text-indigo-400" size={18} />
        <h2 className="text-lg font-bold text-white select-none">
          <span>Operations & Presets</span>
        </h2>
      </div>

      {/* 1. Custom Equation Loader */}
      <div className={`p-4 shrink-0 ${THEME_GLASS.CARD}`}>
        <h3 className="text-xs font-bold text-white mb-2.5 flex items-center gap-2 select-none">
          <Terminal className="text-indigo-400" size={14} />
          <span>Load Equation Workspace</span>
        </h3>
        <form onSubmit={handleLoadCustom} className="flex gap-2">
          <input
            type="text"
            value={inputStr}
            onChange={(e) => setInputStr(e.target.value)}
            placeholder="Type equation, e.g. 2x + 4 = 10"
            className="flex-1 px-3 py-1.5 text-xs bg-neutral-950 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-indigo-500/80 transition-all font-mono"
          />
          <button
            type="submit"
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 active:scale-95 ${THEME_TRANSITIONS.FAST}`}
          >
            Load
          </button>
        </form>

        {errorStr && (
          <div className="mt-2.5 flex items-start gap-2 text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-2">
            <ShieldAlert size={12} className="shrink-0 mt-0.5" />
            <span className="break-all">{errorStr}</span>
          </div>
        )}
      </div>

      {/* 2. Global Operations Panel */}
      <div className={`p-4 shrink-0 ${THEME_GLASS.CARD} flex flex-col gap-3`}>
        <h3 className="text-xs font-bold text-white flex items-center gap-2 select-none">
          <Sparkles className="text-indigo-400" size={14} />
          <span>Global Operations (Both Sides)</span>
        </h3>

        {/* Action button Grid */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => applyGlobalOp('square')}
            className={`py-1.5 px-3.5 text-[11px] font-semibold rounded-xl border border-white/10 text-indigo-200 hover:text-white hover:bg-white/5 active:scale-98 ${THEME_TRANSITIONS.FAST}`}
          >
            Square ( )²
          </button>
          <button
            onClick={() => applyGlobalOp('sqrt')}
            className={`py-1.5 px-3.5 text-[11px] font-semibold rounded-xl border border-white/10 text-indigo-200 hover:text-white hover:bg-white/5 active:scale-98 ${THEME_TRANSITIONS.FAST}`}
          >
            Square Root √
          </button>
        </div>

        <div className="border-t border-white/5 pt-3 flex flex-col gap-2.5">
          <div className="flex gap-2">
            <input
              type="text"
              value={termInput}
              onChange={(e) => setTermInput(e.target.value)}
              placeholder="Specify term, e.g. 5x"
              className="flex-1 px-3 py-1.5 text-xs bg-neutral-950 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-indigo-500/80 transition-all font-mono"
            />
          </div>

          {/* Inline operations grid */}
          <div className="grid grid-cols-4 gap-1.5">
            <button
              onClick={() => applyGlobalOp('add')}
              className={`p-2 bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/20 text-indigo-300 rounded-lg flex items-center justify-center transition-all duration-150 active:scale-90`}
              title="Add term"
            >
              <Plus size={12} />
            </button>
            <button
              onClick={() => applyGlobalOp('sub')}
              className={`p-2 bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/20 text-indigo-300 rounded-lg flex items-center justify-center transition-all duration-150 active:scale-90`}
              title="Subtract term"
            >
              <Minus size={12} />
            </button>
            <button
              onClick={() => applyGlobalOp('mul')}
              className={`p-2 bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/20 text-indigo-300 rounded-lg flex items-center justify-center transition-all duration-150 active:scale-90`}
              title="Multiply by term"
            >
              <X size={12} />
            </button>
            <button
              onClick={() => applyGlobalOp('div')}
              className={`p-2 bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/20 text-indigo-300 rounded-lg flex items-center justify-center transition-all duration-150 active:scale-90`}
              title="Divide by term"
            >
              <Percent size={12} className="rotate-45" />
            </button>
          </div>
        </div>
      </div>

      {/* 3. Unified Presets Library */}
      <div className="flex-1 flex flex-col gap-2.5 min-h-0 border-t border-white/10 pt-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-white/50 select-none flex items-center gap-1 shrink-0">
          <Hash size={12} className="text-indigo-400" />
          <span>Presets Library</span>
        </h3>
        <div className="flex-1 flex flex-col gap-2 overflow-y-auto pr-1">
          {MATH_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => handlePresetSelect(preset.equation)}
              className="flex items-center justify-between text-left p-2.5 rounded-xl border border-white/5 bg-white/0 hover:bg-white/5 hover:border-white/10 group transition-all duration-200 shrink-0"
            >
              <div className="flex-1 min-w-0 pr-2">
                <div className="text-xs text-indigo-300 font-semibold group-hover:text-indigo-200 transition-colors">
                  {preset.label}
                </div>
                <div className="text-xs font-mono text-white/70 group-hover:text-white transition-colors truncate">
                  {preset.equation}
                </div>
              </div>
              <Play
                size={11}
                className="text-white/20 group-hover:text-indigo-400 group-hover:translate-x-0.5 transform transition-all duration-200 shrink-0"
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
