'use client';

import React from 'react';
import { useSetAtom, useAtomValue } from 'jotai';
import * as math from 'mathjs';
import { autoSimplify, Equation } from 'math-engine';
import {
  currentEquationAtom,
  pushEquationAtom,
  resetToEquationStringAtom,
} from '../store/equation';
import { THEME_GLASS, THEME_TRANSITIONS } from '../constants/theme';
import { Sparkles, Terminal, ShieldAlert, Plus, Minus, X, Percent } from 'lucide-react';

// Global Index Value Constants
const CONST_POWER_TWO = 2;
const SIMULATION_DURATION = 800; // ms scanning duration

export const ControlPanel: React.FC = () => {
  const currentEq = useAtomValue(currentEquationAtom);
  const pushEquation = useSetAtom(pushEquationAtom);
  const resetToEquation = useSetAtom(resetToEquationStringAtom);

  const [inputStr, setInputStr] = React.useState('');
  const [errorStr, setErrorStr] = React.useState<string | null>(null);

  // Global operations parameter state
  const [termInput, setTermInput] = React.useState('');
  const [isSimplifying, setIsSimplifying] = React.useState(false);

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

  const handleAutoSimplify = () => {
    setIsSimplifying(true);

    // Simulate standard scanning animation
    setTimeout(() => {
      try {
        setErrorStr(null);
        const simplified = autoSimplify(currentEq);
        pushEquation(simplified); // Push to step timeline
      } catch (err) {
        setErrorStr(`Auto-Simplify failed: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setIsSimplifying(false);
      }
    }, SIMULATION_DURATION);
  };

  return (
    <div className="flex flex-col gap-6 w-full select-none">
      {/* 1. Custom Equation Loader */}
      <div className={`p-5 ${THEME_GLASS.CARD}`}>
        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
          <Terminal className="text-indigo-400" size={16} />
          <span>Load Equation Workspace</span>
        </h3>
        <form onSubmit={handleLoadCustom} className="flex gap-2">
          <input
            type="text"
            value={inputStr}
            onChange={(e) => setInputStr(e.target.value)}
            placeholder="Type equation, e.g. 2x + 4 = 10"
            className="flex-1 px-3 py-2 text-sm bg-neutral-950 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-indigo-500/80 transition-all font-mono"
          />
          <button
            type="submit"
            className={`px-4 py-2 text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 active:scale-95 ${THEME_TRANSITIONS.FAST}`}
          >
            Load
          </button>
        </form>

        <div className="mt-4 flex flex-col gap-1.5 border-t border-white/10 pt-3">
          <span className="text-[10px] text-white/40 font-semibold uppercase tracking-wider">
            Quick Sample Presets
          </span>
          <div className="flex flex-col gap-2">
            {[
              { label: 'Linear Equation', eq: '3 * x + 5 = x + 13' },
              { label: 'Multi-Variable Literal', eq: 'a * b + c = d' },
              { label: 'Ratio & Fraction Group', eq: '(x + 4) / 2 = y - 1' },
            ].map((sample) => (
              <button
                key={sample.eq}
                type="button"
                onClick={() => {
                  try {
                    setErrorStr(null);
                    resetToEquation(sample.eq);
                  } catch (err) {
                    setErrorStr(err instanceof Error ? err.message : String(err));
                  }
                }}
                className={`w-full text-left px-3 py-2 text-xs rounded-xl bg-white/5 border border-white/5 text-indigo-300 hover:text-white hover:bg-white/10 active:scale-98 transition-all flex items-center justify-between cursor-pointer group ${THEME_TRANSITIONS.FAST}`}
              >
                <span className="font-medium">{sample.label}</span>
                <span className="font-mono text-[10px] text-zinc-400 group-hover:text-indigo-200 transition-colors">
                  {sample.eq}
                </span>
              </button>
            ))}
          </div>
        </div>

        {errorStr && (
          <div className="mt-3 flex items-start gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-2.5">
            <ShieldAlert size={14} className="shrink-0 mt-0.5" />
            <span className="break-all">{errorStr}</span>
          </div>
        )}
      </div>

      {/* 2. Global Operations Panel */}
      <div className={`p-5 ${THEME_GLASS.CARD} flex flex-col gap-4`}>
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Sparkles className="text-indigo-400" size={16} />
          <span>Global Operations (Both Sides)</span>
        </h3>

        {/* Action button Grid */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => applyGlobalOp('square')}
            className={`py-2 px-3 text-xs font-semibold rounded-xl border border-white/10 text-indigo-200 hover:text-white hover:bg-white/5 active:scale-98 ${THEME_TRANSITIONS.FAST}`}
          >
            Square ( )²
          </button>
          <button
            onClick={() => applyGlobalOp('sqrt')}
            className={`py-2 px-3 text-xs font-semibold rounded-xl border border-white/10 text-indigo-200 hover:text-white hover:bg-white/5 active:scale-98 ${THEME_TRANSITIONS.FAST}`}
          >
            Square Root √
          </button>
        </div>

        <div className="border-t border-white/10 pt-4 flex flex-col gap-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={termInput}
              onChange={(e) => setTermInput(e.target.value)}
              placeholder="Specify term, e.g. 5x"
              className="flex-1 px-3 py-2 text-xs bg-neutral-950 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-indigo-500/80 transition-all font-mono"
            />
          </div>

          {/* Inline operations grid */}
          <div className="grid grid-cols-4 gap-1.5">
            <button
              onClick={() => applyGlobalOp('add')}
              className={`p-2 bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/20 text-indigo-300 rounded-lg flex items-center justify-center transition-all duration-150 active:scale-90`}
              title="Add term"
            >
              <Plus size={14} />
            </button>
            <button
              onClick={() => applyGlobalOp('sub')}
              className={`p-2 bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/20 text-indigo-300 rounded-lg flex items-center justify-center transition-all duration-150 active:scale-90`}
              title="Subtract term"
            >
              <Minus size={14} />
            </button>
            <button
              onClick={() => applyGlobalOp('mul')}
              className={`p-2 bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/20 text-indigo-300 rounded-lg flex items-center justify-center transition-all duration-150 active:scale-90`}
              title="Multiply by term"
            >
              <X size={14} />
            </button>
            <button
              onClick={() => applyGlobalOp('div')}
              className={`p-2 bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/20 text-indigo-300 rounded-lg flex items-center justify-center transition-all duration-150 active:scale-90`}
              title="Divide by term"
            >
              <Percent size={14} className="rotate-45" />
            </button>
          </div>
        </div>
      </div>

      {/* 3. Auto-Simplify Pass */}
      <button
        onClick={handleAutoSimplify}
        disabled={isSimplifying}
        className={`w-full py-3 bg-gradient-to-r from-indigo-600 via-indigo-500 to-indigo-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-indigo-500/25 active:scale-98 transition-all flex items-center justify-center gap-2 group disabled:opacity-50`}
      >
        <Sparkles size={16} className={`${isSimplifying ? 'animate-spin' : 'group-hover:rotate-12 transition-transform'}`} />
        <span>{isSimplifying ? 'Analyzing Redundancies...' : 'Run Automated Simplifier'}</span>
      </button>

      {/* Visual scanning backdrop in DOM when simplifying */}
      {isSimplifying && (
        <div className="fixed inset-0 bg-indigo-950/20 backdrop-blur-[1px] flex items-center justify-center z-50 pointer-events-none">
          <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_49%,rgba(99,102,241,0.15)_50%,transparent_51%)] bg-[size:100%_20px] animate-[pulse_1s_infinite] select-none" />
        </div>
      )}
    </div>
  );
};
