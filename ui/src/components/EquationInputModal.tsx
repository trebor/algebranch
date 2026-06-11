'use client';

import React from 'react';
import { useAtom, useSetAtom } from 'jotai';
import { motion, AnimatePresence } from 'framer-motion';
import { X, PenTool, HelpCircle, AlertCircle, Check, BookOpen, ArrowRight } from 'lucide-react';
import {
  equationInputModalOpenAtom,
  resetToEquationStringAtom
} from '../store/equation';
import { PreviewEquationNode } from './PreviewEquationNode';
import { parseEquation, Equation } from 'math-engine-client';
import { THEME_GLASS } from '../constants/theme';
import { trackEvent } from '../utils/analytics';
import { Tooltip } from './Tooltip';

export const EquationInputModal: React.FC = () => {
  const [isOpen, setIsOpen] = useAtom(equationInputModalOpenAtom);
  const resetToEquation = useSetAtom(resetToEquationStringAtom);

  const [inputStr, setInputStr] = React.useState('');
  const [parsedEq, setParsedEq] = React.useState<Equation | null>(null);
  const [errorStr, setErrorStr] = React.useState<string | null>(null);
  const [infoStr, setInfoStr] = React.useState<string | null>(null);

  // Auto-focus input on mount
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      // Reset inputs when opened
      setInputStr('');
      setParsedEq(null);
      setErrorStr(null);
      setInfoStr(null);
      
      // Delay focus slightly for framer-motion entry animation
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
      return () => clearTimeout(timer);
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [isOpen]);

  // Escape key close handler
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, setIsOpen]);

  // Real-time parser validation
  React.useEffect(() => {
    const trimmed = inputStr.trim();
    if (!trimmed) {
      setParsedEq(null);
      setErrorStr(null);
      setInfoStr(null);
      return;
    }

    // 1. Check if the user is in the middle of typing the LHS and hasn't added "=" yet
    if (!trimmed.includes('=')) {
      setParsedEq(null);
      setErrorStr(null);
      setInfoStr('Add an "=" sign to complete your equation (e.g. 2*x + 4 = 10)');
      return;
    }

    const parts = trimmed.split('=');
    // 2. Check for multiple equal signs
    if (parts.length > 2) {
      setParsedEq(null);
      setInfoStr(null);
      setErrorStr('An equation must contain exactly one "=" sign');
      return;
    }

    // 3. Check if either side is empty (incomplete typing state)
    if (!parts[0].trim() || !parts[1].trim()) {
      setParsedEq(null);
      setErrorStr(null);
      setInfoStr('Add algebraic terms to both sides of the "=" sign');
      return;
    }

    // 4. Try parsing the equation
    try {
      const parsed = parseEquation(trimmed);
      setParsedEq(parsed);
      setErrorStr(null);
      setInfoStr(null);
    } catch (err) {
      setParsedEq(null);
      setInfoStr(null);
      
      let rawMsg = err instanceof Error ? err.message : String(err);
      
      // Helpfully intercept common math.js syntax errors to guide users
      if (rawMsg.toLowerCase().includes('value expected') || rawMsg.toLowerCase().includes('unexpected operator')) {
        rawMsg = `${rawMsg} (Hint: use "*" for multiplication like "3*x" instead of "3x")`;
      }
      setErrorStr(rawMsg);
    }
  }, [inputStr]);

  const handleClose = () => {
    setIsOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (errorStr || !inputStr.trim()) return;

    try {
      resetToEquation(inputStr.trim());
      trackEvent({
        action: 'load_custom_equation',
        category: 'presets',
        label: inputStr.trim(),
      });
      setIsOpen(false);
    } catch (err) {
      setErrorStr(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-4">
          {/* Backdrop overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0 bg-neutral-950/80 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', duration: 0.35, bounce: 0.12 }}
            className={`w-full h-full max-h-screen rounded-none md:rounded-2xl p-6 md:max-w-xl md:h-auto md:max-h-[90vh] overflow-hidden relative z-10 flex flex-col ${THEME_GLASS.PANEL} shadow-[0_0_50px_rgba(99,102,241,0.15)]`}
          >
            {/* Ambient background glow */}
            <div className="absolute -top-16 -right-16 w-36 h-36 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -z-10 animate-pulse" />

            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4 select-none shrink-0">
              <div className="flex items-center gap-2.5">
                <PenTool className="text-indigo-400 w-5 h-5" />
                <h2 className="text-lg font-bold text-white tracking-wide">Enter Equation</h2>
              </div>
              <button
                onClick={handleClose}
                className="p-1.5 rounded-lg border border-white/5 bg-white/5 text-white/50 hover:text-white hover:bg-white/10 hover:border-white/15 transition-all cursor-pointer"
                aria-label="Close dialog"
              >
                <X size={16} />
              </button>
            </div>

            {/* Form & Input Area (Top) */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-4 flex-1 overflow-y-auto">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="eq-input" className="text-xs text-white/60 font-semibold select-none">
                  Equation Input
                </label>
                <div className="relative">
                  <input
                    ref={inputRef}
                    id="eq-input"
                    type="text"
                    value={inputStr}
                    onChange={(e) => setInputStr(e.target.value)}
                    placeholder="Enter equation, e.g. 2*x + 4 = 10"
                    className="w-full h-11 pl-4 pr-10 text-sm bg-neutral-950/80 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-indigo-500/80 focus:ring-1 focus:ring-indigo-500/30 transition-all font-mono"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck="false"
                  />
                  {inputStr.trim() && !errorStr && (
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-emerald-400 animate-pulse">
                      <Check size={16} />
                    </div>
                  )}
                </div>
              </div>

              {/* Preview or Error Area (Below Input) */}
              <div className="flex-1 min-h-[120px] flex flex-col gap-1.5">
                <span className="text-xs text-white/60 font-semibold select-none">
                  Status & Preview
                </span>
                
                <div className="flex-1 bg-neutral-950/80 border border-white/5 rounded-xl p-4 flex items-center justify-center relative min-h-[100px]">
                  {/* Empty state */}
                  {!inputStr.trim() && (
                    <div className="text-center text-xs text-white/30 flex flex-col items-center gap-2 select-none">
                      <KeyboardIcon className="opacity-40" />
                      <span>Type an algebraic equation above to see its parsed preview.</span>
                    </div>
                  )}

                  {/* Incomplete / Typing Helper state */}
                  {infoStr && !errorStr && (
                    <div className="w-full text-left text-xs text-indigo-300/80 bg-indigo-500/5 border border-indigo-500/10 rounded-xl p-3 flex items-start gap-2.5 animate-[fadeIn_0.15s_ease-out]">
                      <HelpCircle size={14} className="shrink-0 mt-0.5 text-indigo-400/70" />
                      <span className="leading-relaxed">{infoStr}</span>
                    </div>
                  )}

                  {/* Error state */}
                  {errorStr && (
                    <div className="w-full text-left text-xs text-amber-400 bg-amber-500/5 border border-amber-500/10 rounded-xl p-3 flex items-start gap-2.5 animate-[fadeIn_0.15s_ease-out]">
                      <AlertCircle size={14} className="shrink-0 mt-0.5 text-amber-400/70" />
                      <span className="leading-relaxed">{errorStr}</span>
                    </div>
                  )}

                  {/* Preview state (Valid Equation) */}
                  {parsedEq && !errorStr && (
                    <div className="flex flex-col items-center gap-3 w-full animate-[fadeIn_0.15s_ease-out]">
                      <span className="text-[9px] uppercase tracking-wider text-emerald-400 font-semibold select-none flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                        Valid Equation
                      </span>
                      
                      <div className="flex items-center justify-center gap-[0.4em] flex-nowrap w-max pointer-events-none select-none max-w-full overflow-x-auto py-2 text-base">
                        <div className="flex justify-end min-w-[2em]">
                          <PreviewEquationNode path="lhs" customEquation={parsedEq} />
                        </div>
                        <span className="text-[1.1em] font-light font-mono px-[0.5em] py-[0.15em] border border-white/10 rounded-[0.4em] text-white/70 bg-white/5">
                          =
                        </span>
                        <div className="flex justify-start min-w-[2em]">
                          <PreviewEquationNode path="rhs" customEquation={parsedEq} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-white/40 border-t border-white/5 pt-3 select-none shrink-0">
                <a
                  href="https://mathjs.org/docs/expressions/syntax.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 hover:text-indigo-400 transition-colors cursor-pointer group"
                >
                  <BookOpen size={12} className="group-hover:rotate-3 transition-transform" />
                  <span>Math.js Syntax Documentation</span>
                </a>
              </div>

              {/* Footer Actions */}
              <div className="flex items-center justify-end gap-3 border-t border-white/5 pt-4 shrink-0">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 text-xs font-semibold rounded-xl text-white/70 hover:text-white bg-white/5 hover:bg-white/10 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!parsedEq || !!errorStr}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-indigo-600/60 shadow-lg shadow-indigo-600/10 active:scale-95 disabled:active:scale-100 transition-all duration-150 flex items-center gap-1 cursor-pointer"
                >
                  <span>Use Equation</span>
                  <ArrowRight size={12} />
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

const KeyboardIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    width="24"
    height="24"
    stroke="currentColor"
    strokeWidth="2"
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <rect x="2" y="4" width="20" height="16" rx="2" ry="2" />
    <line x1="6" y1="8" x2="6" y2="8" />
    <line x1="10" y1="8" x2="10" y2="8" />
    <line x1="14" y1="8" x2="14" y2="8" />
    <line x1="18" y1="8" x2="18" y2="8" />
    <line x1="6" y1="12" x2="6" y2="12" />
    <line x1="10" y1="12" x2="10" y2="12" />
    <line x1="14" y1="12" x2="14" y2="12" />
    <line x1="18" y1="12" x2="18" y2="12" />
    <line x1="7" y1="16" x2="17" y2="16" />
  </svg>
);
